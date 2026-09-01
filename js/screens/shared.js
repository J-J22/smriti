import { el } from '../core/dom.js';

// The one persistent escape hatch on the patient side. onLeave lets a screen
// tear down its timers and speech before the route changes.
//
// A tap goes Home, as it always has. Holding it for two seconds crosses to the
// caregiver side instead — the same gesture and the same duration as the corner
// on Patient Home, but reachable from any screen. Note that this puts the
// crossing on the patient's most-used control: the fill is what makes an
// accidental hold visible in time to let go, and it is the only thing that does.
const HOLD_MS = 2000;

export function homeIcon(navigate, content, onLeave) {
  const button = el('button', {
    class: 'home-icon',
    'aria-label': content.common.home,
  }, '🏠');

  let holdTimer = null;
  let crossed = false;   // a completed hold must not also register as a tap

  function endHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    button.classList.remove('is-holding');
  }

  button.addEventListener('pointerdown', (event) => {
    crossed = false;
    // Captured so a finger drifting off the icon during the hold does not
    // cancel it, and touch-action in the CSS stops Android reading the hold as
    // the start of a scroll.
    try {
      button.setPointerCapture(event.pointerId);
    } catch (err) {
      /* capture is an improvement, not a requirement */
    }
    button.classList.add('is-holding');
    holdTimer = setTimeout(() => {
      crossed = true;
      endHold();
      // Still the screen's own teardown: a session left running behind the
      // caregiver dashboard would keep its timers alive.
      if (onLeave) onLeave();
      navigate('caregiver-dashboard');
    }, HOLD_MS);
  });

  button.addEventListener('pointerup', endHold);
  button.addEventListener('pointercancel', endHold);
  button.addEventListener('contextmenu', (event) => event.preventDefault());

  button.addEventListener('click', () => {
    // The click that follows a completed hold is not a tap on Home.
    if (crossed) {
      crossed = false;
      return;
    }
    if (onLeave) onLeave();
    navigate('patient-home');
  });

  return button;
}

export function backButton(navigate, target, content) {
  return el('button', {
    class: 'back-btn',
    onclick: () => navigate(target),
  }, content.common.back);
}
