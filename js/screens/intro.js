/* Intro. Speaks once, then advances itself. Nothing to press. */
(function (S) {
  'use strict';
  var el = S.dom.el, tap = S.dom.tap;

  S.screens = S.screens || {};
  S.screens.intro = {
    id: 'intro',

    mount: function (root, ctx) {
      var line = S.content.t('speech.intro');

      var title = el('div', { 'class': 'prompt big-line', role: 'button', tabindex: '0',
                              text: S.content.t('screens.intro.title') });
      var dots = el('div', { 'class': 'dots' }, [
        el('div', { 'class': 'dot on' }),
        el('div', { 'class': 'dot' }),
        el('div', { 'class': 'dot' })
      ]);

      root.appendChild(title);
      root.appendChild(dots);

      function say() {
        ctx.speak(line, function () { ctx.after(700, function () { ctx.done(); }); });
      }
      tap(title, say);      // replay restarts the pause, so nothing is missed
      say();
    }
  };
})(window.Smriti = window.Smriti || {});
