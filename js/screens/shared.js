import { el } from '../core/dom.js';

// The one persistent escape hatch on the patient side. onLeave lets a screen
// tear down its timers and speech before the route changes.
export function homeIcon(navigate, content, onLeave) {
  return el('button', {
    class: 'home-icon',
    'aria-label': content.common.home,
    onclick: () => {
      if (onLeave) onLeave();
      navigate('patient-home');
    },
  }, '🏠');
}

export function backButton(navigate, target, content) {
  return el('button', {
    class: 'back-btn',
    onclick: () => navigate(target),
  }, content.common.back);
}
