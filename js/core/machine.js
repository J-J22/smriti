/* The patient rails.

   Screens do not navigate. A screen mounts, speaks, takes one tap and calls
   ctx.done(). This module alone decides what comes next. That is the whole
   reason the patient side is a state machine and not an app: there is no menu,
   no back button, no history, and no way to end up somewhere unexpected.

   Home → Intro → Game1 → Game2 → Game3 → Praise → Home. */
(function (S) {
  'use strict';

  var SEQUENCE = [
    'home',
    'intro',
    'game:reminiscence',
    'game:matching',
    'game:spot',
    'praise'
  ];

  var host = null, chrome = null, homeBtn = null;
  var currentName = null, unmount = null, ctxToken = 0;

  function screenFor(name) { return S.screens[name] || null; }

  /* Games not built yet are simply absent from S.screens; the loop closes. */
  function nextFrom(name) {
    var i = SEQUENCE.indexOf(name);
    for (var j = i + 1; j < SEQUENCE.length; j++) {
      if (screenFor(SEQUENCE[j])) return SEQUENCE[j];
    }
    return 'home';
  }

  function buildChrome() {
    var el = S.dom.el;
    homeBtn = el('button', {
      'class': 'home-btn',
      'aria-label': S.content.t('ui.home'),
      hidden: true
    }, [houseIcon()]);
    S.dom.tap(homeBtn, function () { Machine.go('home', { reason: 'home-button' }); });
    document.body.appendChild(homeBtn);
    chrome = homeBtn;
  }

  function houseIcon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M12 3 2.5 11.2h2.6V21h5.1v-5.6h3.6V21h5.1v-9.8h2.6z');
    p.setAttribute('fill', '#1E1A16');
    svg.appendChild(p);
    return svg;
  }

  var Machine = {
    init: function (mountEl) {
      host = mountEl;
      buildChrome();
    },

    current: function () { return currentName; },

    go: function (name, payload) {
      if (!screenFor(name)) name = 'home';

      // Hard cut: kill audio and every pending timer from the old screen.
      S.voice.cancel();
      ctxToken++;
      if (unmount) { try { unmount(); } catch (e) {} unmount = null; }
      host.innerHTML = '';

      currentName = name;
      homeBtn.hidden = (name === 'home');

      var def = screenFor(name);
      var section = S.dom.el('section', {
        'class': 'screen is-active',
        'data-screen': name
      });
      host.appendChild(section);

      var token = ctxToken;
      var timers = [];

      var ctx = {
        payload: payload || {},

        /* Speak, then run onEnd — unless the screen has already been left. */
        speak: function (text, onEnd) {
          S.voice.speak(text, {
            onEnd: function () { if (token === ctxToken && onEnd) onEnd(); }
          });
        },

        /* Timers that cannot outlive the screen. */
        after: function (ms, fn) {
          var id = setTimeout(function () {
            if (token === ctxToken) fn();
          }, ms);
          timers.push(id);
          return id;
        },

        done: function (result) {
          if (token !== ctxToken) return;          // stale callback, ignore
          Machine.go(nextFrom(name), result || {});
        },

        goHome: function () {
          if (token !== ctxToken) return;
          Machine.go('home', { reason: 'screen' });
        }
      };

      var cleanup = def.mount(section, ctx);
      unmount = function () {
        for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
        if (typeof cleanup === 'function') cleanup();
      };

      S.bus.emit('screen:enter', name);
    }
  };

  S.screens = S.screens || {};
  S.machine = Machine;
})(window.Smriti = window.Smriti || {});
