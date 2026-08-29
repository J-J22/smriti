/* Tiny DOM helpers. Keeps the screen modules readable without a framework. */
(function (S) {
  'use strict';

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (!attrs.hasOwnProperty(k)) continue;
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    if (kids) {
      if (!Array.isArray(kids)) kids = [kids];
      for (var i = 0; i < kids.length; i++) {
        if (kids[i] == null) continue;
        n.appendChild(typeof kids[i] === 'string'
          ? document.createTextNode(kids[i]) : kids[i]);
      }
    }
    return n;
  }

  /* Single large tap. No swipe, no long-press, no double-fire, and every tap
     doubles as the gesture that unlocks audio. */
  function tap(node, fn) {
    var busy = false;
    node.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (busy) return;
      busy = true;
      setTimeout(function () { busy = false; }, 350);
      // Run the handler first: if it moves to a new screen, that screen's
      // speak() queues, and unlock() below flushes it inside this same
      // gesture — which is what browsers require to let audio start.
      fn(ev);
      S.voice.unlock();
    });
    return node;
  }

  /* Deliberate ≥ms hold. Used ONLY for the caregiver door. */
  function hold(node, ms, fn) {
    var timer = null;
    function start(ev) {
      if (ev.type === 'touchstart' && ev.touches && ev.touches.length > 1) return;
      cancel();
      node.classList.add('is-holding');
      timer = setTimeout(function () { cancel(); fn(); }, ms);
    }
    function cancel() {
      if (timer) { clearTimeout(timer); timer = null; }
      node.classList.remove('is-holding');
    }
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('mousedown', start);
    ['touchend', 'touchcancel', 'touchmove', 'mouseup', 'mouseleave'].forEach(function (e) {
      node.addEventListener(e, cancel);
    });
    node.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return node;
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  S.dom = { el: el, tap: tap, hold: hold, shuffle: shuffle };
})(window.Smriti = window.Smriti || {});
