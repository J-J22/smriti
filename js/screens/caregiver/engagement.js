import { el } from '../../core/dom.js';
import { backButton } from '../shared.js';
import { formatWhen } from '../../core/format.js';
import { barChart, sparkline } from '../../core/chart.js';
import {
  sessionsPerDay,
  accuracyTrend,
  expectedTrend,
  levelTrend,
  practiceStreak,
} from '../../core/analytics.js';
import { MIN_ROUNDS_TO_STEER, TARGET_SUCCESS } from '../../core/model.js';
import { getAllEngagement, getSessions, EXERCISE_IDS } from '../../core/store.js';

const RECENT_SHOWN = 10;
const CHART_DAYS = 14;
const TREND_POINTS = 8;
const MIN_ROUNDS_FOR_TREND = 4;

export function renderEngagement(container, params, navigate, content) {
  const c = content.caregiver.engagement;
  const records = getAllEngagement();
  const sessions = getSessions();
  const practised = EXERCISE_IDS.filter((id) => records[id].totalRounds > 0);
  const daily = sessionsPerDay(sessions, CHART_DAYS);

  container.appendChild(el('div', { class: 'caregiver-screen' }, [
    el('h1', {}, c.title),
    el('p', { class: 'section-intro' }, c.intro),

    el('div', { class: 'stat-row' }, [
      stat(c.sessionsLabel, String(sessions.length)),
      stat(c.streakLabel, String(practiceStreak(sessions))),
      stat(c.lastSessionLabel, sessions.length
        ? formatWhen(sessions[sessions.length - 1].ts, content.common.when, null,
            content.common.clock)
        : content.common.when.never),
    ]),

    el('section', { class: 'chart-card' }, [
      el('h2', {}, c.chartTitle),
      sessions.length
        ? barChart(daily, { label: c.chartTitle })
        : el('p', { class: 'empty-state' }, c.chartEmpty),
      sessions.length
        ? el('div', { class: 'chart-axis' }, [
            el('span', {}, c.chartFrom),
            el('span', {}, c.chartTo),
          ])
        : null,
    ]),

    practised.length ? null : el('p', { class: 'empty-state' }, c.empty),
    el('div', { class: 'card-list' },
      EXERCISE_IDS.map((id) => renderExerciseCard(c, id, records[id]))),

    el('div', { class: 'info-box' }, [
      el('h3', {}, c.howItWorksTitle),
      el('p', {}, c.howItWorks),
      el('h3', {}, c.modelHowTitle),
      el('p', {}, c.modelHow.replace('{p}', String(Math.round(TARGET_SUCCESS * 100)))),
    ]),
    el('p', { class: 'privacy-note' }, c.privacyNote),
    backButton(navigate, 'caregiver-dashboard', content),
  ]));
}

function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-value' }, value),
    el('span', { class: 'stat-label' }, label),
  ]);
}

function changeText(c, record) {
  if (!record.totalRounds) return c.noRounds;
  if (record.lastChange === 'up') return c.changeUp;
  if (record.lastChange === 'down') return c.changeDown;
  if (record.lastChange === 'repeat') return c.changeRepeat;
  return c.changeNone;
}

function renderExerciseCard(c, id, record) {
  const levelName = c.levels[record.difficulty - 1] || String(record.difficulty);
  const firstTry = record.totalRounds
    ? record.totalCorrect + ' / ' + record.totalRounds
    : '—';
  const recent = record.rounds.slice(-RECENT_SHOWN);
  const enoughForTrend = record.rounds.length >= MIN_ROUNDS_FOR_TREND;

  return el('section', { class: 'exercise-card' }, [
    el('h2', {}, c.exerciseNames[id] || id),
    el('div', { class: 'level-row' }, [
      el('span', { class: 'level-label' }, c.levelLabel),
      el('span', { class: 'level-pill', 'data-level': String(record.difficulty) }, levelName),
    ]),
    el('div', { class: 'stat-row' }, [
      stat(c.roundsLabel, String(record.totalRounds)),
      stat(c.firstTryLabel, firstTry),
    ]),

    el('div', { class: 'trend' }, [
      el('span', { class: 'stat-label' }, c.trendLabel),
      // The dashed overlay is what the model expected before each round was
      // answered. Tracking the solid line is the learner working; drifting
      // away from it is the learner being wrong, and both are worth seeing.
      enoughForTrend
        ? sparkline(accuracyTrend(record.rounds, TREND_POINTS), {
            label: c.modelExpectedLabel,
            overlay: expectedTrend(record.rounds, TREND_POINTS),
          })
        : el('span', { class: 'empty-state' },
            record.totalRounds ? c.trendNotEnough : c.noRounds),
      // The level line shares the card so the adaptive story reads at a glance:
      // accuracy holding up while the level climbs is the shape to look for.
      enoughForTrend
        ? sparkline(levelTrend(record.rounds, TREND_POINTS),
            { min: 1, max: 3, height: 30, label: c.levelLabel })
        : null,
    ]),

    el('div', { class: 'recent' }, [
      el('span', { class: 'stat-label' }, c.recentLabel),
      recent.length
        ? el('div', { class: 'round-marks' }, recent.map((round) =>
            el('span', { class: round.correct ? 'mark is-correct' : 'mark' })))
        : el('span', { class: 'empty-state' }, c.noRounds),
    ]),
    el('p', { class: 'adaptive-note' }, changeText(c, record)),
    modelNote(c, record),
  ]);
}

// What the on-device learner has actually seen, stated plainly. Before it has
// enough rounds it says so rather than implying it is already steering.
function modelNote(c, record) {
  const trained = (record.model && record.model.trained) || 0;
  if (trained < MIN_ROUNDS_TO_STEER) {
    return el('p', { class: 'model-note' }, [
      el('span', { class: 'model-tag' }, c.modelLabel),
      el('span', {}, c.modelWatching.replace('{n}', String(MIN_ROUNDS_TO_STEER - trained))),
    ]);
  }
  return el('p', { class: 'model-note' }, [
    el('span', { class: 'model-tag' }, c.modelLabel),
    el('span', {}, c.modelTrained.replace('{n}', String(trained)) + ' ' +
      c.modelPredicted.replace('{p}', String(Math.round((record.predicted || 0) * 100)))),
  ]);
}
