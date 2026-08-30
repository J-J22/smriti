import { el } from '../../core/dom.js';
import { backButton } from '../shared.js';
import { formatTime, formatWhen, isToday } from '../../core/format.js';
import {
  getReminders,
  getNextReminder,
  getMemories,
  getSessions,
  getLastActiveAt,
  isDoneToday,
} from '../../core/store.js';

export function renderOverview(container, params, navigate, content) {
  const c = content.caregiver.overview;
  const when = content.common.when;
  const reminders = getReminders();
  const doneToday = reminders.filter((reminder) => isDoneToday(reminder)).length;
  const sessionsToday = getSessions().filter((session) => isToday(session.ts)).length;
  const next = getNextReminder();

  container.appendChild(el('div', { class: 'caregiver-screen' }, [
    el('h1', {}, c.title),
    el('div', { class: 'stat-row' }, [
      stat(c.lastActiveLabel, formatWhen(getLastActiveAt(), when)),
    ]),
    el('div', { class: 'stat-row' }, [
      stat(c.remindersTodayLabel, reminders.length ? String(reminders.length) : c.noneToday),
      stat(c.remindersDoneLabel, String(doneToday)),
    ]),
    el('div', { class: 'stat-row' }, [
      stat(c.nextReminderLabel, next ? formatTime(next.time) : c.nothingUpcoming),
      stat(c.sessionsTodayLabel, String(sessionsToday)),
    ]),
    el('div', { class: 'stat-row' }, [
      stat(c.photosLabel, String(getMemories().length)),
    ]),
    el('p', { class: 'privacy-note' }, c.privacyNote),
    backButton(navigate, 'caregiver-dashboard', content),
  ]));
}

function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-value' }, value),
    el('span', { class: 'stat-label' }, label),
  ]);
}
