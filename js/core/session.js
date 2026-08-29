/* One run through the games = one session record, kept on-device for the
   caregiver's ENGAGEMENT HISTORY. It records what happened during activities,
   nothing more: no score is ever shown to the patient, and none of this is a
   measure of the person. */
(function (S) {
  'use strict';

  var live = null;

  var Session = {
    begin: function () {
      live = { startedAt: Date.now(), endedAt: null, activities: [] };
      return live;
    },

    record: function (gameId, entry) {
      if (!live) Session.begin();
      live.activities.push({
        game: gameId,
        item: entry.item,
        level: entry.level,
        firstTryCorrect: !!entry.firstTryCorrect,
        at: Date.now()
      });
    },

    /* Called from Praise, closing the loop. */
    finish: function () {
      if (!live) return Promise.resolve(null);
      live.endedAt = Date.now();
      var record = live;
      live = null;
      record.engagedSeconds = Math.round((record.endedAt - record.startedAt) / 1000);
      record.adaptive = S.adaptive.snapshot();
      return S.store.addSession(record).then(function () { return record; });
    },

    current: function () { return live; }
  };

  S.session = Session;
})(window.Smriti = window.Smriti || {});
