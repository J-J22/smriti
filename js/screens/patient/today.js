import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';

export function renderToday(container, params, navigate, content) {
  const c = content.patient.today;
  container.appendChild(
    el('div', { class: 'patient-screen' }, [
      homeIcon(navigate, content),
      el('h1', {}, c.title),
      el('p', {}, c.empty),
    ])
  );
}
