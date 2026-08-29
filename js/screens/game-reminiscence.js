/* Game 1 — Reminiscence recall (the hero).

   A familiar scene, a spoken question, two big picture answers.
   This file is the PATTERN the other two games follow:
     pick items by adaptive level → run one round → answer advances →
     wrong answers get warm redirection, never a failure → report to session.
   There is no timer, no score, and no way to get stuck. */
(function (S) {
  'use strict';
  var el = S.dom.el, tap = S.dom.tap, shuffle = S.dom.shuffle;

  var GAME = 'reminiscence';
  var ROUNDS = 3;
  var REDIRECT_RESCUE_MS = 5000;   // if they don't take the hint, move on kindly

  /* Prefer items at the current level; widen outward until we have enough. */
  function chooseItems(items, level, count) {
    var byDistance = items.slice().sort(function (a, b) {
      return Math.abs((a.level || 1) - level) - Math.abs((b.level || 1) - level);
    });
    var atLevel = shuffle(byDistance.filter(function (i) { return (i.level || 1) === level; }));
    var rest = byDistance.filter(function (i) { return (i.level || 1) !== level; });
    return atLevel.concat(rest).slice(0, count);
  }

  S.screens = S.screens || {};
  S.screens['game:reminiscence'] = {
    id: GAME,

    mount: function (root, ctx) {
      var game = S.content.get('games.reminiscence');
      if (!game || !game.items || !game.items.length) { ctx.done(); return; }

      var level = S.adaptive.levelFor(GAME);
      var queue = chooseItems(game.items, level, ROUNDS);
      var round = 0;

      var currentPrompt = '';
      var promptEl = el('div', { 'class': 'prompt', role: 'button', tabindex: '0' });
      var sceneEl = el('img', { 'class': 'scene', alt: '' });
      var optionsEl = el('div', { 'class': 'options' });

      root.appendChild(sceneEl);
      root.appendChild(promptEl);
      root.appendChild(optionsEl);

      tap(promptEl, function () { ctx.speak(currentPrompt); });

      function nextRound() {
        if (round >= queue.length) { ctx.done(); return; }
        var item = queue[round++];
        renderRound(item);
      }

      function renderRound(item) {
        var answered = false;

        currentPrompt = item.prompt;
        promptEl.textContent = item.prompt;
        sceneEl.setAttribute('src', item.scene);
        sceneEl.setAttribute('alt', item.sceneAlt || '');

        optionsEl.className = 'options';
        optionsEl.innerHTML = '';

        var buttons = [];
        shuffle(item.options).forEach(function (opt) {
          var b = el('button', { 'class': 'option', 'aria-label': opt.label }, [
            el('img', { src: opt.image, alt: '' }),
            el('span', { 'class': 'cap', text: opt.label })
          ]);
          b._opt = opt;
          buttons.push(b);
          tap(b, function () { choose(b, opt); });
          optionsEl.appendChild(b);
        });

        function correctButton() {
          for (var i = 0; i < buttons.length; i++) if (buttons[i]._opt.correct) return buttons[i];
          return buttons[0];
        }

        function choose(button, opt) {
          if (opt.correct) return accept(button, !answered);
          if (answered) return;               // already redirected; ignore taps
          answered = true;
          redirect(item);
        }

        function accept(button, firstTry) {
          if (optionsEl.classList.contains('is-locked')) return;   // one answer only
          optionsEl.classList.add('is-locked');
          button.classList.add('is-right');
          if (firstTry) S.adaptive.record(GAME, true);
          S.session.record(GAME, {
            item: item.id, level: item.level || 1, firstTryCorrect: !!firstTry
          });
          ctx.speak(S.content.t('speech.affirm'), function () {
            ctx.after(500, nextRound);
          });
        }

        /* Warm redirection. We point at the intended answer and invite the
           tap; if it doesn't come, we move on anyway. Never a wrong buzzer. */
        function redirect() {
          S.adaptive.record(GAME, false);
          var right = correctButton();
          right.classList.add('is-guide');
          ctx.speak(S.content.t('speech.redirect'));
          ctx.after(REDIRECT_RESCUE_MS, function () {
            if (!optionsEl.classList.contains('is-locked')) accept(right, false);
          });
        }

        ctx.speak(item.prompt);
      }

      nextRound();
    }
  };
})(window.Smriti = window.Smriti || {});
