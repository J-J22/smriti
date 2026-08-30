import { el } from '../core/dom.js';

export function homeIcon(navigate, content) {
  return el('button', {
    class: 'home-icon',
    'aria-label': content.common.home,
    onclick: () => navigate('patient-home'),
  }, '🏠');
}

export function backButton(navigate, target, content) {
  return el('button', {
    class: 'back-btn',
    onclick: () => navigate(target),
  }, content.common.back);
}
