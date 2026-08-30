import { el } from '../../core/dom.js';
import { backButton } from '../shared.js';

export function renderReminders(container, params, navigate, content) {
  const c = content.caregiver.reminders;

  if (params.form) {
    container.appendChild(renderForm(navigate, c));
    return;
  }

  container.appendChild(
    el('div', { class: 'caregiver-screen' }, [
      el('h1', {}, c.title),
      el('p', { class: 'empty-state' }, c.empty),
      el('button', { class: 'big-btn', onclick: () => navigate('caregiver-reminders', { form: true }) }, c.add),
      backButton(navigate, 'caregiver-dashboard', content),
    ])
  );
}

function renderForm(navigate, c) {
  return el('div', { class: 'caregiver-screen' }, [
    el('h1', {}, c.addTitle),
    el('label', {}, [
      'Type',
      el('select', { name: 'type' }, Object.entries(c.types).map(([value, label]) =>
        el('option', { value }, label)
      )),
    ]),
    el('label', {}, ['Time', el('input', { type: 'time', name: 'time' })]),
    el('div', { class: 'form-buttons' }, [
      el('button', { class: 'big-btn', onclick: () => navigate('caregiver-reminders') }, c.save),
      el('button', { class: 'big-btn', onclick: () => navigate('caregiver-reminders') }, c.cancel),
    ]),
  ]);
}
