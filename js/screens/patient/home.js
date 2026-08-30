import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';
import { speak, stopSpeaking } from '../../core/voice.js';
import { getDueReminders, markReminderDone } from '../../core/store.js';

const LONG_PRESS_MS = 2000;

export function renderPatientHome(container, params, navigate, content) {
  const c = content.patient.home;
  let pressTimer = null;

  // A UX gate, not authentication: dim, low contrast, and a deliberate hold,
  // so a confused patient cannot stumble into the caregiver side.
  const corner = el('div', {
    class: 'caregiver-corner',
    onpointerdown: () => {
      pressTimer = setTimeout(() => navigate('caregiver-dashboard'), LONG_PRESS_MS);
    },
    onpointerup: () => clearTimeout(pressTimer),
    onpointercancel: () => clearTimeout(pressTimer),
    onpointerleave: () => clearTimeout(pressTimer),
  });

  container.appendChild(el('div', { class: 'patient-screen patient-home' }, [
    homeIcon(navigate, content, stopSpeaking),
    el('h1', {}, c.title),
    el('div', { class: 'card-grid' }, [
      el('button', { class: 'big-card', onclick: () => navigate('today') }, c.today),
      el('button', { class: 'big-card', onclick: () => navigate('exercises') }, c.exercises),
      el('button', { class: 'big-card', onclick: () => navigate('memories') }, c.memories),
    ]),
    corner,
  ]));

  showDueReminder(container, content, navigate);
}

// A due reminder covers the screen until it is acknowledged. One button, one
// action: Done logs it and returns to Home.
function showDueReminder(container, content, navigate) {
  const c = content.patient.reminderCard;
  const types = content.caregiver.reminders.types;
  const due = getDueReminders();
  if (!due.length) return;

  const reminder = due[0];
  const typeLabel = types[reminder.type] || reminder.type;

  const card = el('div', { class: 'reminder-overlay' }, [
    el('div', { class: 'reminder-card' }, [
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

  container.appendChild(card);
  speak(c.speech.replace('{type}', typeLabel));
}
