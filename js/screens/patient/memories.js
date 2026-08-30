import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';

export function renderMemories(container, params, navigate, content) {
  const c = content.patient.memories;
  const photos = c.photos;
  const index = ((params.index || 0) % photos.length + photos.length) % photos.length;

  container.appendChild(
    el('div', { class: 'patient-screen' }, [
      homeIcon(navigate, content),
      el('h1', {}, c.title),
      el('p', {}, photos[index]),
      el('div', { class: 'nav-row' }, [
        el('button', { class: 'big-btn', onclick: () => navigate('memories', { index: index - 1 }) }, c.previous),
        el('button', { class: 'big-btn', onclick: () => navigate('memories', { index: index + 1 }) }, c.next),
      ]),
    ])
  );
}
