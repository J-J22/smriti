import { el } from '../../core/dom.js';
import { backButton } from '../shared.js';
import { formatWhen } from '../../core/format.js';
import { getAllEngagement, getSessions, EXERCISE_IDS } from '../../core/store.js';

const RECENT_SHOWN = 8;

export function renderEngagement(container, params, navigate, content) {
  const c = content.caregiver.engagement;
  const records = getAllEngagement();
  const sessions = getSessions();
  const practised = EXERCISE_IDS.filter((id) => records[id].totalRounds > 0);

  const cards = EXERCISE_IDS.map((id) => renderExerciseCard(c, id, records[id]));

  container.appendChild(el('div', { class: 'caregiver-screen' }, [
    el('h1', {}, c.title),
    el('p', { class: 'section-intro' }, c.intro),
    practised.length ? null : el('p', { class: 'empty-state' }, c.empty),
    el('div', { class: 'stat-row' }, [
      stat(c.sessionsLabel, String(sessions.length)),
      stat(c.lastSessionLabel, sessions.length
        ? formatWhen(sessions[sessions.length - 1].ts, content.common.when, null,
            content.common.clock)
        : content.common.when.never),
    ]),
    el('div', { class: 'card-list' }, cards),
    el('div', { class: 'info-box' }, [
      el('h3', {}, c.howItWorksTitle),
      el('p', {}, c.howItWorks),
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
    el('div', { class: 'recent' }, [
      el('span', { class: 'stat-label' }, c.recentLabel),
      recent.length
        ? el('div', { class: 'round-marks' }, recent.map((round) =>
            el('span', {
              class: round.correct ? 'mark is-correct' : 'mark',
              title: String(round.promptId || ''),
            })))
        : el('span', { class: 'empty-state' }, c.noRounds),
    ]),
    el('p', { class: 'adaptive-note' }, changeText(c, record)),
  ]);
}
