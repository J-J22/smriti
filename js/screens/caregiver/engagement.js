import { el } from '../../core/dom.js';
import { backButton } from '../shared.js';

export function renderEngagement(container, params, navigate, content) {
  const c = content.caregiver.engagement;
  container.appendChild(
    el('div', { class: 'caregiver-screen' }, [
      el('h1', {}, c.title),
      el('p', { class: 'empty-state' }, c.empty),
      backButton(navigate, 'caregiver-dashboard', content),
    ])
  );
}
