import { el } from '../../core/dom.js';
import { currentAlerts, actionableCount } from './alerts.js';

export function renderCaregiverDashboard(container, params, navigate, content) {
  const c = content.caregiver.dashboard;
  const pending = actionableCount(currentAlerts(content));
  container.appendChild(
    el('div', { class: 'caregiver-screen' }, [
      el('h1', {}, c.title),
      el('nav', { class: 'menu' }, [
        el('button', {
          class: 'menu-btn',
          onclick: () => navigate('caregiver-overview'),
        }, [
          el('span', {}, c.overview),
          pending ? el('span', { class: 'menu-badge' }, String(pending)) : null,
        ]),
        el('button', { class: 'menu-btn', onclick: () => navigate('caregiver-reminders') }, c.reminders),
        el('button', { class: 'menu-btn', onclick: () => navigate('caregiver-engagement') }, c.engagement),
        el('button', { class: 'menu-btn', onclick: () => navigate('caregiver-memories-settings') }, c.memoriesSettings),
      ]),
      el('button', { class: 'switch-btn', onclick: () => navigate('patient-home') }, c.switchToPatient),
    ])
  );
}
