import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';
import { speak, stopSpeaking } from '../../core/voice.js';
import { formatTime } from '../../core/format.js';
import { getNextReminder, getDueReminders, touchActivity } from '../../core/store.js';

function greeting(c, now) {
  const hours = now.getHours();
  if (hours < 12) return c.greetingMorning;
  if (hours < 17) return c.greetingAfternoon;
  return c.greetingEvening;
}

export function renderToday(container, params, navigate, content) {
  const c = content.patient.today;
  const types = content.caregiver.reminders.types;
  const now = new Date();
  const due = getDueReminders(now);
  const next = getNextReminder(now);
  const shown = due.length ? due[0] : next;
  const isDue = due.length > 0;

  touchActivity();

  const hello = greeting(c, now);
  let body;
  let speech;

  if (shown) {
    const typeLabel = types[shown.type] || shown.type;
    body = el('div', { class: 'today-card' }, [
      el('p', { class: 'today-label' }, isDue ? c.dueNow : c.nextLabel),
      el('p', { class: 'today-type' }, typeLabel),
      shown.label ? el('p', { class: 'today-note' }, shown.label) : null,
      el('p', { class: 'today-time' }, formatTime(shown.time, content.common.clock)),
    ]);
    speech = isDue
      ? hello + ' ' + c.dueNow + ' ' + typeLabel + '.'
      : hello + ' ' + c.speechNext
          .replace('{type}', typeLabel)
          .replace('{time}', formatTime(shown.time, content.common.clock));
  } else {
    body = el('p', { class: 'exercise-lead' }, c.nothing);
    speech = hello + ' ' + c.nothingSpeech;
  }

  container.appendChild(el('div', { class: 'patient-screen' }, [
    homeIcon(navigate, content, stopSpeaking),
    el('h1', {}, hello),
    body,
  ]));

  speak(speech);
}
