/* Adaptive difficulty — a plain rules engine, offline, no ML, no cloud.
     3 correct in a row  → one level harder
     2 wrong in a row    → one level easier (and repeat that level)
   It tracks ACTIVITY PERFORMANCE only. It does not measure anything about
   the person, and the caregiver view must never present it as if it did. */
(function (S) {
  'use strict';

  var MIN = 1, MAX = 3;
  var UP_STREAK = 3, DOWN_STREAK = 2;
  var KEY = 'adaptive';
  var state = {};   // gameId -> { level, up, down, seen, correct }

  function slot(gameId) {
    if (!state[gameId]) state[gameId] = { level: MIN, up: 0, down: 0, seen: 0, correct: 0 };
    return state[gameId];
  }

  var Adaptive = {
    load: function () {
      return S.store.getState(KEY, {}).then(function (v) {
        state = v || {};
        return state;
      });
    },

    save: function () { return S.store.setState(KEY, state); },

    levelFor: function (gameId) { return slot(gameId).level; },

    /* Returns { level, changed: 'up'|'down'|null } */
    record: function (gameId, correct) {
      var s = slot(gameId);
      var before = s.level;
      s.seen++;
      if (correct) {
        s.correct++;
        s.up++; s.down = 0;
        if (s.up >= UP_STREAK) { s.level = Math.min(MAX, s.level + 1); s.up = 0; }
      } else {
        s.down++; s.up = 0;
        if (s.down >= DOWN_STREAK) { s.level = Math.max(MIN, s.level - 1); s.down = 0; }
      }
      Adaptive.save();
      return {
        level: s.level,
        changed: s.level > before ? 'up' : s.level < before ? 'down' : null
      };
    },

    /* Read-only snapshot for the caregiver dashboard. */
    snapshot: function () { return JSON.parse(JSON.stringify(state)); },

    reset: function () { state = {}; return Adaptive.save(); }
  };

  S.adaptive = Adaptive;
})(window.Smriti = window.Smriti || {});
