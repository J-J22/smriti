/* Praise. Warm words, session saved, back to Home — the loop closes itself. */
(function (S) {
  'use strict';
  var el = S.dom.el, tap = S.dom.tap;

  S.screens = S.screens || {};
  S.screens.praise = {
    id: 'praise',

    mount: function (root, ctx) {
      var line = S.content.t('speech.praise');

      var title = el('div', { 'class': 'prompt big-line', role: 'button', tabindex: '0',
                              text: S.content.t('screens.praise.title') });
      root.appendChild(title);
      root.appendChild(el('div', { 'class': 'dots' }, [
        el('div', { 'class': 'dot on' }),
        el('div', { 'class': 'dot on' }),
        el('div', { 'class': 'dot on' })
      ]));

      S.session.finish();

      function say() {
        ctx.speak(line, function () { ctx.after(1200, function () { ctx.goHome(); }); });
      }
      tap(title, say);
      say();
    }
  };
})(window.Smriti = window.Smriti || {});
