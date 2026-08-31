// The on-device learner. It predicts how likely this patient is to answer a
// round correctly at a given level, then proposes the level where that chance
// sits near the desirable-difficulty target — hard enough to be worth doing,
// easy enough that failure stays rare.
//
// Online logistic regression, trained by stochastic gradient descent, on this
// device, from this one patient's own rounds. There is no training set, no
// model file to download, no network call: it starts from a plain prior and
// learns as the person practises. Everything here is ~100 lines of arithmetic,
// which is the point — a clinician can audit every decision it makes.
//
// Claim discipline: this predicts SUCCESS IN AN ACTIVITY, nothing else. It is
// not a measure of the person, and it infers no cognitive state.
//
// The rules engine in adaptive.js remains the guardrail: proposeLevel() may
// only ever pick a level immediately next to the one the rules arrived at, so
// the model can nudge but never leap.

import { clampLevel, MIN_LEVEL, MAX_LEVEL } from './adaptive.js';

// The success rate we steer toward. Well below "always right", well above
// frustrating — the band where people stay engaged and failure stays gentle.
export const TARGET_SUCCESS = 0.75;

export const LEARNING_RATE = 0.12;
export const WEIGHT_DECAY = 0.002;
export const WINDOW = 8;            // rounds of recent history a feature sees

// Until it has this many rounds the model only watches. Steering off two or
// three data points would lurch, and the rules engine already handles the
// opening rounds perfectly well.
export const MIN_ROUNDS_TO_STEER = 6;

// A level only wins over the rules engine's choice if it is meaningfully
// closer to the target. Without this the model would flip levels on noise.
export const MIN_GAIN = 0.03;

export const FEATURE_NAMES = ['bias', 'level', 'recentAccuracy', 'recentRetries'];

// The starting prior, before this device has seen anything: at the middle
// level a person answers correctly about three quarters of the time, and
// higher levels are harder. Everything after the first round is learned.
const INITIAL_WEIGHTS = [1.1, -0.5, 0, 0];

export function initialModel() {
  return { weights: INITIAL_WEIGHTS.slice(), trained: 0 };
}

function safeModel(model) {
  if (!model || !Array.isArray(model.weights) ||
      model.weights.length !== FEATURE_NAMES.length ||
      !model.weights.every(Number.isFinite)) {
    return initialModel();
  }
  return model;
}

function sigmoid(z) {
  // Split by sign so neither branch can overflow Math.exp on a long streak.
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

function mean(values, fallback) {
  if (!values.length) return fallback;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

// Every feature is scaled to roughly -1..1 so no single one dominates the
// gradient, and every one is known BEFORE the round is answered — otherwise
// the model would be predicting from the answer it is trying to predict.
export function features(level, rounds) {
  const recent = (rounds || []).slice(-WINDOW);

  const accuracy = mean(recent.map((round) => (round.correct ? 1 : 0)), 0.5);
  const attempts = mean(recent.map((round) => Math.min(3, round.attempts || 1)), 1.5);

  return [
    1,
    clampLevel(level) - 2,                             // -1, 0, 1
    (accuracy - 0.5) * 2,                              // how it has been going
    Math.max(-1, Math.min(1, (attempts - 1.5) * 2)),   // how much retrying it took
  ];
}

export function predict(model, level, rounds) {
  const weights = safeModel(model).weights;
  const x = features(level, rounds);
  let z = 0;
  for (let i = 0; i < weights.length; i++) z += weights[i] * x[i];
  return sigmoid(z);
}

// One SGD step on the round just answered. `rounds` must be the history as it
// stood BEFORE this round, and `level` the level it was actually played at.
// Never mutates the model it is given.
export function learn(model, level, rounds, correct) {
  const current = safeModel(model);
  const x = features(level, rounds);
  const predicted = predict(current, level, rounds);
  const error = (correct ? 1 : 0) - predicted;

  const weights = current.weights.map((weight, i) => {
    // Decay pulls unused weights back toward zero, but never the bias — that
    // one carries the patient's overall success rate and should be free.
    const decay = i === 0 ? 0 : WEIGHT_DECAY * weight;
    const next = weight + LEARNING_RATE * (error * x[i] - decay);
    return Number.isFinite(next) ? next : weight;
  });

  return { weights, trained: current.trained + 1 };
}

// Picks the level to play next. The rules engine has already decided where it
// wants to be; the model may move one step either side of that, and only when
// it is clearly better. Ties fall to the easier level.
export function proposeLevel(model, rounds, rulesLevel) {
  const current = safeModel(model);
  const base = clampLevel(rulesLevel);
  const predicted = predict(current, base, rounds);

  if (current.trained < MIN_ROUNDS_TO_STEER) {
    return {
      level: base,
      predicted,
      steering: false,
      roundsUntilSteering: MIN_ROUNDS_TO_STEER - current.trained,
    };
  }

  let level = base;
  let best = Math.abs(predicted - TARGET_SUCCESS);
  let chosen = predicted;

  for (const candidate of [base - 1, base + 1]) {
    if (candidate < MIN_LEVEL || candidate > MAX_LEVEL) continue;
    const p = predict(current, candidate, rounds);
    const gap = Math.abs(p - TARGET_SUCCESS);
    if (gap < best - MIN_GAIN || (gap < best && candidate < level)) {
      level = candidate;
      best = gap;
      chosen = p;
    }
  }

  return { level, predicted: chosen, steering: true, roundsUntilSteering: 0 };
}
