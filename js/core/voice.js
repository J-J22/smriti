/* Voice leads every screen. Single choke point for speechSynthesis.
   Hard rule: the flow must NEVER stall because TTS is missing, blocked or
   buggy. Every speak() promises to call onEnd exactly once, even on a
   device with no voices at all. */
(function (S) {
  'use strict';

  var synth = window.speechSynthesis || null;
  var cfg = { lang: 'en-IN', fallbackLang: 'en-US', rate: 0.85, pitch: 1.0 };
  var voice = null;
  var unlocked = false;
  var pending = null;      // speech deferred until the first user gesture
  var current = null;      // { done:false, watchdog:id, onEnd:fn }

  function pickVoice() {
    if (!synth || !synth.getVoices) return null;
    var all = synth.getVoices() || [];
    if (!all.length) return null;
    var exact = null, loose = null, fb = null;
    var base = cfg.lang.split('-')[0];
    for (var i = 0; i < all.length; i++) {
      var l = (all[i].lang || '').replace('_', '-');
      if (!exact && l.toLowerCase() === cfg.lang.toLowerCase()) exact = all[i];
      if (!loose && l.toLowerCase().indexOf(base) === 0) loose = all[i];
      if (!fb && l.toLowerCase() === cfg.fallbackLang.toLowerCase()) fb = all[i];
    }
    return exact || loose || fb || all[0];
  }

  /* Rough spoken duration, used when TTS is absent or onend never fires. */
  function estimate(text) {
    var words = String(text).split(/\s+/).length;
    return Math.max(1400, (words / 2.3) * 1000 / (cfg.rate || 1) + 700);
  }

  function finish(token) {
    if (!current || current !== token || token.done) return;
    token.done = true;
    clearTimeout(token.watchdog);
    if (current === token) current = null;
    S.bus.emit('voice:end');
    if (token.onEnd) token.onEnd();
  }

  var Voice = {
    supported: !!(synth && window.SpeechSynthesisUtterance),

    configure: function (c) {
      if (!c) return;
      for (var k in c) if (c.hasOwnProperty(k)) cfg[k] = c[k];
      voice = pickVoice();
    },

    /* Browsers gate audio behind a gesture. Call once from the first tap. */
    unlock: function () {
      if (unlocked) return;
      unlocked = true;
      if (pending) {                       // the real line IS the unlock
        var p = pending; pending = null;
        Voice.speak(p.text, p.opts);
        return;
      }
      if (synth) {
        try {
          var u = new SpeechSynthesisUtterance(' ');
          u.volume = 0;
          synth.speak(u);
        } catch (e) { /* nothing to do */ }
      }
    },

    isUnlocked: function () { return unlocked; },

    cancel: function () {
      if (current) { clearTimeout(current.watchdog); current.done = true; current = null; }
      pending = null;
      if (synth) { try { synth.cancel(); } catch (e) {} }
      S.bus.emit('voice:end');
    },

    /* speak(text, { onEnd })  — onEnd always fires, exactly once. */
    speak: function (text, opts) {
      opts = opts || {};
      Voice.cancel();
      if (!text) { if (opts.onEnd) opts.onEnd(); return; }

      // No gesture yet: hold it, and let the caller's UI wait for the tap.
      if (!unlocked && Voice.supported) {
        pending = { text: text, opts: opts };
        return;
      }

      var token = { done: false, onEnd: opts.onEnd, watchdog: 0 };
      current = token;
      S.bus.emit('voice:start', text);

      var ms = estimate(text);

      if (!Voice.supported) {                 // no TTS: keep the rails moving
        token.watchdog = setTimeout(function () { finish(token); }, ms);
        return;
      }

      try {
        if (!voice) voice = pickVoice();
        var u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.lang = (voice && voice.lang) || cfg.lang;
        u.rate = cfg.rate;
        u.pitch = cfg.pitch;
        u.onend = function () { finish(token); };
        u.onerror = function () { finish(token); };
        synth.speak(u);
        // Chrome drops onend often enough that the rails need a backstop.
        token.watchdog = setTimeout(function () { finish(token); }, ms * 1.9 + 2500);
      } catch (e) {
        token.watchdog = setTimeout(function () { finish(token); }, ms);
      }
    }
  };

  if (synth && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', function () { voice = pickVoice(); });
  }

  S.voice = Voice;
})(window.Smriti = window.Smriti || {});
