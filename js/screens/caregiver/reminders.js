import { el } from '../../core/dom.js';
import { backButton } from '../shared.js';
import { formatTime } from '../../core/format.js';
import {
  getReminders,
  getReminder,
  addReminder,
  updateReminder,
  deleteReminder,
  isDoneToday,
} from '../../core/store.js';

export function renderReminders(container, params, navigate, content) {
  const c = content.caregiver.reminders;

  // params.form is either true (new) or a reminder id (edit).
  if (params.form) {
    const existing = params.form === true ? null : getReminder(params.form);
    container.appendChild(renderForm(navigate, content, c, existing));
    return;
  }

  container.appendChild(renderList(navigate, content, c));
}

function renderList(navigate, content, c) {
  const reminders = getReminders();

  const body = reminders.length
    ? el('ul', { class: 'reminder-list' }, reminders.map((reminder) =>
        renderRow(navigate, c, reminder)))
    : el('p', { class: 'empty-state' }, c.empty);

  const count = reminders.length === 1
    ? c.countOne
    : c.countMany.replace('{n}', String(reminders.length));

  return el('div', { class: 'caregiver-screen' }, [
    el('h1', {}, c.title),
    reminders.length ? el('p', { class: 'list-count' }, count) : null,
    body,
    el('button', {
      class: 'big-btn',
      onclick: () => navigate('caregiver-reminders', { form: true }),
    }, c.add),
    backButton(navigate, 'caregiver-dashboard', content),
  ]);
}

function renderRow(navigate, c, reminder) {
  const typeLabel = c.types[reminder.type] || reminder.type;
  return el('li', { class: 'reminder-row' }, [
    el('button', {
      class: 'reminder-open',
      onclick: () => navigate('caregiver-reminders', { form: reminder.id }),
    }, [
      el('span', { class: 'reminder-time' }, formatTime(reminder.time)),
      el('span', { class: 'reminder-meta' }, [
        el('span', { class: 'reminder-type' }, typeLabel),
        reminder.label ? el('span', { class: 'reminder-note' }, reminder.label) : null,
        isDoneToday(reminder) ? el('span', { class: 'reminder-done' }, c.doneToday) : null,
      ]),
    ]),
  ]);
}

function renderForm(navigate, content, c, existing) {
  const typeSelect = el('select', { name: 'type', id: 'reminder-type' },
    Object.keys(c.types).map((value) =>
      el('option', { value: value }, c.types[value])));

  const timeInput = el('input', { type: 'time', name: 'time', id: 'reminder-time' });
  const noteInput = el('input', {
    type: 'text',
    name: 'note',
    id: 'reminder-note',
    placeholder: c.notePlaceholder,
  });

  if (existing) {
    typeSelect.value = existing.type;
    timeInput.value = existing.time;
    noteInput.value = existing.label || '';
  }

  const error = el('p', { class: 'form-error', 'aria-live': 'polite' }, '');

  function save() {
    const time = timeInput.value;
    if (!time) {
      error.textContent = c.timeRequired;
      timeInput.focus();
      return;
    }
    const values = { type: typeSelect.value, time: time, label: noteInput.value.trim() };
    if (existing) updateReminder(existing.id, values);
    else addReminder(values);
    navigate('caregiver-reminders');
  }

  function remove() {
    if (!window.confirm(c.confirmDelete)) return;
    deleteReminder(existing.id);
    navigate('caregiver-reminders');
  }

  return el('div', { class: 'caregiver-screen' }, [
    el('h1', {}, existing ? c.editTitle : c.addTitle),
    el('div', { class: 'field' }, [
      el('label', { for: 'reminder-type' }, c.typeLabel),
      typeSelect,
    ]),
    el('div', { class: 'field' }, [
      el('label', { for: 'reminder-time' }, c.timeLabel),
      timeInput,
    ]),
    el('div', { class: 'field' }, [
      el('label', { for: 'reminder-note' }, c.noteLabel),
      noteInput,
    ]),
    error,
    el('div', { class: 'form-buttons' }, [
      el('button', { class: 'big-btn', onclick: save }, c.save),
      el('button', {
        class: 'big-btn is-secondary',
        onclick: () => navigate('caregiver-reminders'),
      }, c.cancel),
    ]),
    existing ? el('button', { class: 'danger-btn', onclick: remove }, c.delete) : null,
    backButton(navigate, 'caregiver-reminders', content),
  ]);
}
