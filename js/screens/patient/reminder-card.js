// The due-reminder card, and the watcher that makes it actually arrive.
//
// Checking only when Patient Home is drawn meant a reminder could come due
// while the patient sat looking at the screen and nothing would happen. This
// polls, so the card appears on its own.
//
// It cannot fire while the app is closed — that needs an OS-level alarm, which
// is not available to a page without a server. Documented, not pretended.

import { el } from '../../core/dom.js';
import { speak, stopSpeaking } from '../../core/voice.js';
import { getDueReminders, markReminderDone } from '../../core/store.js';

const CHECK_MS = 30000;

// Routes where a reminder may interrupt. An exercise in progress is left
// alone: the card would break the round, and the patient is already engaged.
// It surfaces as soon as they come back to Home.
const INTERRUPTIBLE = ['patient-home', 'today', 'memories'];

let timer = null;

export function buildDueCard(reminder, content, navigate) {
  const c = content.patient.reminderCard;
  const types = content.caregiver.reminders.types;
  const typeLabel = types[reminder.type] || reminder.type;

  const card = el('div', { class: 'reminder-overlay' }, [
    el('div', { class: 'reminder-card' }, [
      el('div', { class: 'reminder-bell', 'aria-hidden': 'true' }, '🔔'),
      el('p', { class: 'reminder-heading' }, c.heading),
      el('p', { class: 'reminder-type-big' }, typeLabel),
      reminder.label ? el('p', { class: 'reminder-note-big' }, reminder.label) : null,
      el('button', {
        class: 'big-btn',
        onclick: () => {
          markReminderDone(reminder.id);
          stopSpeaking();
          navigate('patient-home');
        },
      }, c.done),
    ]),
  ]);

  speak(c.speech.replace('{type}', typeLabel));
  return card;
}

// Used by Patient Home on render.
export function showDueReminder(container, content, navigate) {
  const due = getDueReminders();
  if (!due.length) return;
  container.appendChild(buildDueCard(due[0], content, navigate));
}

function currentRoute() {
  return (window.location.hash || '').slice(1) || 'entry';
}

function tick(content, navigate) {
  if (INTERRUPTIBLE.indexOf(currentRoute()) === -1) return;
  // Never stack a second card over one still waiting to be acknowledged.
  if (document.querySelector('.reminder-overlay')) return;
  const due = getDueReminders();
  if (!due.length) return;
  const app = document.getElementById('app');
  if (app) app.appendChild(buildDueCard(due[0], content, navigate));
}

export function startReminderWatch(content, navigate) {
  if (timer) clearInterval(timer);
  timer = setInterval(() => tick(content, navigate), CHECK_MS);
  return timer;
}

export function stopReminderWatch() {
  if (timer) clearInterval(timer);
  timer = null;
}
