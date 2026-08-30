// Offline rules engine. No ML, no cloud, no inference about the person —
// it only reacts to performance in an activity: 3 right in a row -> harder,
// 2 wrong -> easier. Pure functions; store.js owns persistence.

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 3;
export const RAISE_AFTER_CORRECT = 3;
export const LOWER_AFTER_WRONG = 2;

export function clampLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(n)));
}

export function initialState(baselineDifficulty) {
  return {
    difficulty: clampLevel(baselineDifficulty),
    correctStreak: 0,
    wrongStreak: 0,
    lastChange: null,
  };
}

// Returns the next adaptive state. Never mutates the input.
export function nextState(state, correct) {
  let difficulty = clampLevel(state.difficulty);
  let correctStreak = state.correctStreak || 0;
  let wrongStreak = state.wrongStreak || 0;
  let lastChange = null;

  if (correct) {
    correctStreak += 1;
    wrongStreak = 0;
    if (correctStreak >= RAISE_AFTER_CORRECT) {
      correctStreak = 0;
      if (difficulty < MAX_LEVEL) {
        difficulty += 1;
        lastChange = 'up';
      }
    }
  } else {
    wrongStreak += 1;
    correctStreak = 0;
    if (wrongStreak >= LOWER_AFTER_WRONG) {
      wrongStreak = 0;
      // At the easiest level there is nowhere to go down: repeat instead.
      lastChange = difficulty > MIN_LEVEL ? 'down' : 'repeat';
      if (difficulty > MIN_LEVEL) difficulty -= 1;
    }
  }

  return { difficulty, correctStreak, wrongStreak, lastChange };
}
