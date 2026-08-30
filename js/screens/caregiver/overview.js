import { el } from '../../core/dom.js';
import { backButton } from '../shared.js';

export function renderOverview(container, params, navigate, content) {
  container.appendChild(
    el('div', { class: 'caregiver-screen' }, [
      el('h1', {}, content.caregiver.overview.title),
      backButton(navigate, 'caregiver-dashboard', content),
    ])
  );
}
