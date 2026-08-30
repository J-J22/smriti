import { el } from '../core/dom.js';

export function renderEntry(container, params, navigate, content) {
  const c = content.entry;
  container.appendChild(
    el('div', { class: 'entry-screen patient-screen' }, [
      el('div', { class: 'entry-mark', 'aria-hidden': 'true' }, c.mark),
      el('h1', {}, c.title),
      el('p', { class: 'entry-tagline' }, c.tagline),
      el('div', { class: 'card-grid' }, [
        el('button', { class: 'big-btn', onclick: () => navigate('patient-home') }, c.patientButton),
        el('button', {
          class: 'big-btn is-quiet',
          onclick: () => navigate('caregiver-dashboard'),
        }, c.caregiverButton),
      ]),
    ])
  );
}
