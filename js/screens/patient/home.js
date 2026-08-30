import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';
import { speak, stopSpeaking } from '../../core/voice.js';
import { formatTime } from '../../core/format.js';
import { getDueReminders, getNextReminder, markReminderDone } from '../../core/store.js';

const LONG_PRESS_MS = 2000;

function greeting(c, now) {
  const hours = now.getHours();
  if (hours < 12) return c.greetingMorning;
  if (hours < 17) return c.greetingAfternoon;
  return c.greetingEvening;
}

function card(iconFile, title, subtitle, onclick) {
  return el('button', { class: 'big-card', onclick: onclick }, [
    el('span', { class: 'card-icon', 'aria-hidden': 'true' }, [
      el('img', { src: 'assets/icons/' + iconFile, alt: '' }),
    ]),
    el('span', { class: 'card-text' }, [
      el('span', {}, title),
      el('span', { class: 'card-sub' }, subtitle),
    ]),
  ]);
}

export function renderPatientHome(container, params, navigate, content) {
  const c = content.patient.home;
  const types = content.caregiver.reminders.types;
  const now = new Date();
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

  const next = getNextReminder(now);
  const strip = next
    ? el('p', { class: 'home-next' }, [
        el('span', {}, c.nextStrip
          .replace('{type}', types[next.type] || next.type)
          .replace('{time}', formatTime(next.time, content.common.clock))),
      ])
    : el('p', { class: 'home-next' }, c.nothingNext);

  container.appendChild(el('div', { class: 'patient-screen patient-home' }, [
    homeIcon(navigate, content, stopSpeaking),
    el('h1', { class: 'home-greeting' }, greeting(c, now)),
    strip,
    el('div', { class: 'card-grid' }, [
      card('nav-today.svg', c.today, c.todaySub, () => navigate('today')),
      card('nav-exercise.svg', c.exercises, c.exercisesSub, () => navigate('exercises')),
      card('nav-memories.svg', c.memories, c.memoriesSub, () => navigate('memories')),
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

  container.appendChild(el('div', { class: 'reminder-overlay' }, [
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
  ]));

  speak(c.speech.replace('{type}', typeLabel));
}
