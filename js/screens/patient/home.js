import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';

export function renderPatientHome(container, params, navigate, content) {
  const c = content.patient.home;
  let pressTimer = null;

  const corner = el('div', {
    class: 'caregiver-corner',
    onpointerdown: () => {
      pressTimer = setTimeout(() => navigate('caregiver-dashboard'), 2000);
    },
    onpointerup: () => clearTimeout(pressTimer),
    onpointerleave: () => clearTimeout(pressTimer),
  });

  container.appendChild(
    el('div', { class: 'patient-screen patient-home' }, [
      homeIcon(navigate, content),
      el('h1', {}, c.title),
      el('div', { class: 'card-grid' }, [
        el('button', { class: 'big-card', onclick: () => navigate('today') }, c.today),
        el('button', { class: 'big-card', onclick: () => navigate('exercises') }, c.exercises),
        el('button', { class: 'big-card', onclick: () => navigate('memories') }, c.memories),
      ]),
      corner,
    ])
  );
}
