import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';
import { speak, stopSpeaking } from '../../core/voice.js';
import { formatTime } from '../../core/format.js';
import { getNextReminder } from '../../core/store.js';
import { showDueReminder } from './reminder-card.js';

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
