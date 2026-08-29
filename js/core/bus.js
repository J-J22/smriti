/* Minimal event bus. Screens talk to core through this, never to each other. */
(function (S) {
  'use strict';
  var map = {};
  S.bus = {
    on: function (name, fn) {
      (map[name] = map[name] || []).push(fn);
      return function () { S.bus.off(name, fn); };
    },
    off: function (name, fn) {
      var l = map[name]; if (!l) return;
      for (var i = l.length - 1; i >= 0; i--) if (l[i] === fn) l.splice(i, 1);
    },
    emit: function (name, data) {
      var l = map[name]; if (!l) return;
      var snapshot = l.slice();          // a handler may unsubscribe mid-emit
      for (var i = 0; i < snapshot.length; i++) {
        try { snapshot[i](data); } catch (e) { if (window.console) console.error(e); }
      }
    }
  };
})(window.Smriti = window.Smriti || {});
