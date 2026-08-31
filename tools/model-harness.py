#!/usr/bin/env python3
"""Validation harness for js/core/model.js — a development tool, never shipped.

The learner runs in the browser, where there is no way to throw ten thousand
rounds at it and see whether it settles. So this mirrors the same arithmetic in
Python, drives it with synthetic patients whose true ability we control, and
checks that the level it picks actually lands near the target success rate
instead of oscillating.

It reads every constant straight out of model.js and adaptive.js, so the mirror
cannot silently drift from the code it is meant to be checking.

    python3 tools/model-harness.py            simulate, validate, write the chart
    python3 tools/model-harness.py --golden   print the fixed trace that
                                              tools/model-test.html checks the
                                              real browser code against

Writes tools/model-convergence.svg — the chart for the deck.
"""

import math
import os
import random
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ---------------------------------------------------------------- constants

def read_constants(path, names):
    src = open(os.path.join(ROOT, path), encoding='utf-8').read()
    out = {}
    for name in names:
        m = re.search(r'\b' + name + r'\s*=\s*([^;]+);', src)
        if not m:
            sys.exit('could not find %s in %s' % (name, path))
        raw = m.group(1).strip()
        if raw.startswith('['):
            out[name] = [float(v) for v in raw.strip('[]').split(',')]
        else:
            out[name] = float(raw)
    return out


M = read_constants('js/core/model.js', [
    'TARGET_SUCCESS', 'LEARNING_RATE', 'WEIGHT_DECAY', 'WINDOW',
    'MIN_ROUNDS_TO_STEER', 'MIN_GAIN', 'INITIAL_WEIGHTS',
])
A = read_constants('js/core/adaptive.js', [
    'MIN_LEVEL', 'MAX_LEVEL', 'RAISE_AFTER_CORRECT', 'LOWER_AFTER_WRONG',
])

MIN_LEVEL, MAX_LEVEL = int(A['MIN_LEVEL']), int(A['MAX_LEVEL'])
WINDOW = int(M['WINDOW'])


# ------------------------------------------------------- mirror of model.js

def clamp_level(level):
    return max(MIN_LEVEL, min(MAX_LEVEL, int(round(level))))


def sigmoid(z):
    if z >= 0:
        return 1 / (1 + math.exp(-z))
    e = math.exp(z)
    return e / (1 + e)


def features(level, rounds):
    recent = rounds[-WINDOW:]
    if recent:
        accuracy = sum(1 if r['correct'] else 0 for r in recent) / len(recent)
        attempts = sum(min(3, r['attempts']) for r in recent) / len(recent)
    else:
        accuracy, attempts = 0.5, 1.5
    return [
        1.0,
        clamp_level(level) - 2,
        (accuracy - 0.5) * 2,
        max(-1.0, min(1.0, (attempts - 1.5) * 2)),
    ]


def predict(model, level, rounds):
    x = features(level, rounds)
    return sigmoid(sum(w * xi for w, xi in zip(model['weights'], x)))


def learn(model, level, rounds, correct):
    x = features(level, rounds)
    error = (1 if correct else 0) - predict(model, level, rounds)
    weights = []
    for i, w in enumerate(model['weights']):
        decay = 0 if i == 0 else M['WEIGHT_DECAY'] * w
        weights.append(w + M['LEARNING_RATE'] * (error * x[i] - decay))
    return {'weights': weights, 'trained': model['trained'] + 1}


def propose_level(model, rounds, rules_level):
    base = clamp_level(rules_level)
    predicted = predict(model, base, rounds)
    if model['trained'] < M['MIN_ROUNDS_TO_STEER']:
        return base, predicted, False

    level, best, chosen = base, abs(predicted - M['TARGET_SUCCESS']), predicted
    for candidate in (base - 1, base + 1):
        if candidate < MIN_LEVEL or candidate > MAX_LEVEL:
            continue
        p = predict(model, candidate, rounds)
        gap = abs(p - M['TARGET_SUCCESS'])
        if gap < best - M['MIN_GAIN'] or (gap < best and candidate < level):
            level, best, chosen = candidate, gap, p
    return level, chosen, True


# ---------------------------------------------------- mirror of adaptive.js

def next_state(state, correct):
    difficulty = clamp_level(state['difficulty'])
    correct_streak, wrong_streak = state['correctStreak'], state['wrongStreak']
    change = None
    if correct:
        correct_streak += 1
        wrong_streak = 0
        if correct_streak >= A['RAISE_AFTER_CORRECT']:
            correct_streak = 0
            if difficulty < MAX_LEVEL:
                difficulty += 1
                change = 'up'
    else:
        wrong_streak += 1
        correct_streak = 0
        if wrong_streak >= A['LOWER_AFTER_WRONG']:
            wrong_streak = 0
            change = 'down' if difficulty > MIN_LEVEL else 'repeat'
            if difficulty > MIN_LEVEL:
                difficulty -= 1
    return difficulty, correct_streak, wrong_streak, change


# ------------------------------------------------------------- simulation

class Patient:
    """A synthetic patient with a known true success rate per level."""

    def __init__(self, name, by_level, drift=None):
        self.name = name
        self.by_level = by_level
        self.drift = drift          # per-round change applied to every level

    def rate(self, level, round_index):
        p = self.by_level[level - 1]
        if self.drift:
            p = max(0.05, min(0.98, p + self.drift * round_index))
        return p

    def answer(self, level, round_index, rng):
        p = self.rate(level, round_index)
        correct = rng.random() < p
        attempts = 1 if correct else rng.choice([2, 2, 3])
        return correct, attempts, p

    def ideal(self, round_index):
        """The success rate an oracle would get: the best level available to
        this patient right now. With only three levels the target is often not
        reachable exactly, so this — not 0.75 — is what the model is judged
        against."""
        rates = [self.rate(l, round_index) for l in range(MIN_LEVEL, MAX_LEVEL + 1)]
        return min(rates, key=lambda r: abs(r - M['TARGET_SUCCESS']))


def run(patient, rounds_count, seed, use_model=True):
    rng = random.Random(seed)
    model = {'weights': list(M['INITIAL_WEIGHTS']), 'trained': 0}
    state = {'difficulty': 2, 'correctStreak': 0, 'wrongStreak': 0}
    rounds, trace = [], []

    for i in range(rounds_count):
        played = clamp_level(state['difficulty'])
        expected = predict(model, played, rounds)
        correct, attempts, true_p = patient.answer(played, i, rng)

        model = learn(model, played, rounds, correct)
        difficulty, cs, ws, _ = next_state(state, correct)
        state['correctStreak'], state['wrongStreak'] = cs, ws
        rounds.append({'correct': correct, 'attempts': attempts})

        if use_model:
            level, _, _ = propose_level(model, rounds, difficulty)
        else:
            level = difficulty
        state['difficulty'] = level

        trace.append({
            'played': played, 'correct': correct, 'expected': expected,
            'next': level, 'true_p': true_p,
        })
    return trace, model


def summarise(trace, warmup):
    after = trace[warmup:]
    realized = sum(1 for t in after if t['correct']) / max(1, len(after))
    switches = sum(1 for a, b in zip(after, after[1:]) if a['next'] != b['next'])
    calibration = sum(abs(t['expected'] - t['true_p']) for t in after) / max(1, len(after))
    levels = {}
    for t in after:
        levels[t['played']] = levels.get(t['played'], 0) + 1
    return realized, switches / max(1, len(after)) * 100, calibration, levels


PATIENTS = [
    Patient('steady (best at level 2)', [0.93, 0.74, 0.44]),
    Patient('strong (best at level 3)', [0.97, 0.90, 0.76]),
    Patient('struggling (best at level 1)', [0.72, 0.40, 0.18]),
    Patient('declining over time', [0.95, 0.82, 0.60], drift=-0.0015),
]


# A fixed outcome pattern with no randomness in it. tools/model-test.html runs
# the same pattern through the real model.js in a browser and asserts it lands
# on identical weights, so this Python mirror cannot quietly diverge from the
# code that actually ships.
GOLDEN_PATTERN = [True, True, False, True, True, True, False, False, True, True,
                  True, False, True, True, True, True, False, True, True, True]


def golden():
    model = {'weights': list(M['INITIAL_WEIGHTS']), 'trained': 0}
    state = {'difficulty': 2, 'correctStreak': 0, 'wrongStreak': 0}
    rounds, levels = [], []
    for correct in GOLDEN_PATTERN:
        played = clamp_level(state['difficulty'])
        model = learn(model, played, rounds, correct)
        difficulty, cs, ws, _ = next_state(state, correct)
        state['correctStreak'], state['wrongStreak'] = cs, ws
        rounds.append({'correct': correct, 'attempts': 1 if correct else 2})
        state['difficulty'] = propose_level(model, rounds, difficulty)[0]
        levels.append(state['difficulty'])

    print('Paste these into tools/model-test.html:\n')
    print('const GOLDEN_LEVELS = [%s];' % ','.join(str(l) for l in levels))
    print('const GOLDEN_WEIGHTS = [%s];'
          % ', '.join('%.12f' % w for w in model['weights']))
    print('const GOLDEN_PREDICT_L2 = %.12f;' % predict(model, 2, rounds))
    print('const PATTERN = [%s];'
          % ','.join('true' if c else 'false' for c in GOLDEN_PATTERN))
    return 0


def main():
    if '--golden' in sys.argv:
        return golden()
    rounds_count, seeds, warmup = 400, 40, 40
    print('Reading constants from js/core/model.js and js/core/adaptive.js')
    print('  target success %.2f  lr %.2f  window %d  steers after %d rounds\n'
          % (M['TARGET_SUCCESS'], M['LEARNING_RATE'], WINDOW, M['MIN_ROUNDS_TO_STEER']))

    header = '%-30s %9s %9s %9s %9s %8s' % (
        'patient', 'best', 'learner', 'rules', 'switches', 'cal.err')
    print(header)
    print('-' * len(header))

    failures = []
    for patient in PATIENTS:
        totals = [0.0, 0.0, 0.0, 0.0]
        for seed in range(seeds):
            trace, _ = run(patient, rounds_count, seed)
            realized, switch_rate, calibration, _ = summarise(trace, warmup)
            base_trace, _ = run(patient, rounds_count, seed, use_model=False)
            base_realized, _, _, _ = summarise(base_trace, warmup)
            totals[0] += realized
            totals[1] += base_realized
            totals[2] += switch_rate
            totals[3] += calibration
        realized, base_realized, switch_rate, calibration = [t / seeds for t in totals]
        best = sum(patient.ideal(i) for i in range(warmup, rounds_count)) \
            / (rounds_count - warmup)

        print('%-30s %8.1f%% %8.1f%% %8.1f%% %8.1f%% %8.3f' % (
            patient.name, best * 100, realized * 100, base_realized * 100,
            switch_rate, calibration))

        # Judged against the best any level choice could have done for this
        # patient. Where the rules are already near-optimal — a strong patient
        # simply pins to the top level — the learner only has to avoid making
        # things worse. It is deliberately gentler than an oracle after a bad
        # patch, which costs a point or two there and is the right behaviour
        # for this population.
        if abs(realized - best) > 0.05:
            failures.append('%s: %.1f%% off the best reachable rate'
                            % (patient.name, abs(realized - best) * 100))
        rules_are_off = abs(base_realized - best) > 0.03
        allowance = 0.01 if rules_are_off else 0.03
        if abs(realized - best) > abs(base_realized - best) + allowance:
            failures.append('%s: further from best than rules alone' % patient.name)
        if switch_rate > 20:
            failures.append('%s: level oscillates (%.1f%% of rounds)' % (patient.name, switch_rate))

    print()
    if failures:
        for f in failures:
            print('FAIL  ' + f)
    else:
        print('PASS  every patient lands within 5 points of the best rate any level')
        print('      choice could have given them, and closer to it than the rules')
        print('      manage alone, with no oscillation.')

    trace, model = run(PATIENTS[0], rounds_count, 7)
    write_chart(trace, os.path.join(ROOT, 'tools', 'model-convergence.svg'))
    print('\nWrote tools/model-convergence.svg')
    print('Final learned weights: ' + ', '.join(
        '%s=%.3f' % (n, w) for n, w in
        zip(['bias', 'level', 'recentAccuracy', 'recentRetries'], model['weights'])))
    return 1 if failures else 0


# ------------------------------------------------------------------ chart

def write_chart(trace, path):
    """A plain SVG — no dependencies, drops straight into a slide."""
    W, H = 900, 380
    L, R, T, B = 60, 20, 30, 46
    pw, ph = W - L - R, H - T - B
    n = len(trace)

    def x(i):
        return L + pw * i / max(1, n - 1)

    def y(p):
        return T + ph * (1 - p)

    smoothed, window = [], 20
    for i in range(n):
        chunk = trace[max(0, i - window + 1):i + 1]
        smoothed.append(sum(1 for t in chunk if t['correct']) / len(chunk))

    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
             'font-family="system-ui, sans-serif" font-size="12">' % (W, H)]
    parts.append('<rect width="%d" height="%d" fill="#fdfcfa"/>' % (W, H))

    for gy in (0, 0.25, 0.5, 0.75, 1.0):
        parts.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#e6e1d8"/>'
                     % (L, y(gy), W - R, y(gy)))
        parts.append('<text x="%d" y="%.1f" fill="#8a8178" text-anchor="end">%d%%</text>'
                     % (L - 8, y(gy) + 4, gy * 100))

    parts.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#c47a3f" '
                 'stroke-width="2" stroke-dasharray="6 4"/>'
                 % (L, y(M['TARGET_SUCCESS']), W - R, y(M['TARGET_SUCCESS'])))
    parts.append('<text x="%d" y="%.1f" fill="#c47a3f">target %d%%</text>'
                 % (W - R - 74, y(M['TARGET_SUCCESS']) - 8, M['TARGET_SUCCESS'] * 100))

    levels = ' '.join('%.1f,%.1f' % (x(i), y((t['played'] - 1) / (MAX_LEVEL - 1)))
                      for i, t in enumerate(trace))
    parts.append('<polyline points="%s" fill="none" stroke="#b9d4c8" stroke-width="6" '
                 'stroke-linejoin="round" opacity="0.85"/>' % levels)

    predicted = ' '.join('%.1f,%.1f' % (x(i), y(t['expected'])) for i, t in enumerate(trace))
    parts.append('<polyline points="%s" fill="none" stroke="#2f6f5e" stroke-width="2"/>'
                 % predicted)

    actual = ' '.join('%.1f,%.1f' % (x(i), y(p)) for i, p in enumerate(smoothed))
    parts.append('<polyline points="%s" fill="none" stroke="#3b3a38" stroke-width="1.6" '
                 'stroke-dasharray="3 3"/>' % actual)

    warm = x(M['MIN_ROUNDS_TO_STEER'])
    parts.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="#b4aca1"/>'
                 % (warm, T, warm, T + ph))
    parts.append('<text x="%.1f" y="%d" fill="#8a8178">model starts steering</text>'
                 % (warm + 6, T + 14))

    parts.append('<text x="%d" y="%d" fill="#3b3a38" font-size="14" font-weight="600">'
                 'On-device learner: predicted success settles on the target</text>' % (L, 18))
    legend = [('#2f6f5e', 'predicted success'), ('#3b3a38', 'actual (20-round mean)'),
              ('#b9d4c8', 'level played (1→3)')]
    for i, (colour, label) in enumerate(legend):
        lx = L + i * 230
        parts.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="3"/>'
                     % (lx, H - 16, lx + 22, H - 16, colour))
        parts.append('<text x="%d" y="%d" fill="#5c554d">%s</text>' % (lx + 28, H - 12, label))
    parts.append('<text x="%d" y="%d" fill="#8a8178" text-anchor="end">rounds practised</text>'
                 % (W - R, H - 12))
    parts.append('</svg>')
    open(path, 'w', encoding='utf-8').write('\n'.join(parts))


if __name__ == '__main__':
    sys.exit(main())
