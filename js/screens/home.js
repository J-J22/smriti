/* Home. Spoken greeting + today's date + one big Begin button.
   Also the only door to the caregiver world: dim, cornered, ≥2s long-press. */
(function (S) {
  'use strict';
  var el = S.dom.el, tap = S.dom.tap, hold = S.dom.hold;

  S.screens = S.screens || {};
  S.screens.home = {
    id: 'home',

    mount: function (root, ctx) {
      var now = new Date();
      var greeting = S.content.greeting(now);
      var date = S.content.longDate(now);
      var line = S.content.t('speech.home', { greeting: greeting, date: date });

      var head = el('div', { 'class': 'prompt', role: 'button', tabindex: '0' }, [
        el('h1', { 'class': 'greeting', text: greeting }),
        el('p', { 'class': 'date', text: date })
      ]);
      tap(head, function () { ctx.speak(line); });   // tap the prompt = replay

      var begin = el('button', {
        'class': 'begin-btn',
        text: S.content.t('ui.begin')
      });
      tap(begin, function () {
        S.session.begin();
        ctx.done();
      });

      root.appendChild(head);
      root.appendChild(begin);

      var door = hold(
        el('div', {
          'class': 'caregiver-door',
          role: 'button',
          'aria-label': S.content.t('ui.caregiver')
        }, [el('div', { 'class': 'ring' })]),
        2000,
        function () { S.bus.emit('caregiver:open'); }
      );
      document.body.appendChild(door);

      ctx.speak(line);

      return function () { if (door.parentNode) door.parentNode.removeChild(door); };
    }
  };
})(window.Smriti = window.Smriti || {});
