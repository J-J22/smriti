/* Boot. Load the content pack, wake storage, then hand control to the rails. */
(function (S) {
  'use strict';

  var LANG_KEY = 'language';

  function fatal(msg) {
    document.getElementById('app').innerHTML =
      '<section class="screen is-active"><p class="prompt">' + msg + '</p></section>';
  }

  function boot() {
    S.store.init()
      .then(function () { return S.store.getState(LANG_KEY, 'en'); })
      .then(function (lang) { return S.content.load(lang); })
      .catch(function () { return S.content.load('en'); })   // pack fallback
      .then(function () {
        S.voice.configure(S.content.get('voice'));
        return S.adaptive.load();
      })
      .then(function () {
        document.documentElement.lang = S.content.lang();
        document.documentElement.dir = S.content.get('dir') || 'ltr';
        S.machine.init(document.getElementById('app'));
        S.machine.go('home');
      })
      .catch(function (err) {
        if (window.console) console.error(err);
        fatal('Please open this again in a moment.');
      });
  }

  /* Nothing on the patient side responds to a gesture other than a single
     tap — no zoom, no text selection, no context menu, no pull-to-refresh. */
  function lockGestures() {
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); });
    document.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    }, { passive: false });
  }

  /* Backgrounding the app should not leave a voice talking to an empty room. */
  function handleVisibility() {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) S.voice.cancel();
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline later */ });
    });
  }

  lockGestures();
  handleVisibility();
  registerSW();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.Smriti = window.Smriti || {});
