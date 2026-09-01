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
  //
  // Holding this on a phone used to fail almost every time. Three things were
  // cancelling the press before it could finish, and all three needed fixing:
  // Android reads a hold on a plain div as the start of a scroll and fires
  // pointercancel (the CSS now says touch-action: none), it raises the
  // text-selection callout (refused below), and a finger that drifts a
  // millimetre in two seconds used to leave the 44px target and cancel through
  // pointerleave (the pointer is captured instead, and pointerleave is gone).
  const corner = el('div', { class: 'caregiver-corner' });

  function endPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
    corner.classList.remove('is-pressing');
  }

  corner.addEventListener('pointerdown', (event) => {
    try {
      corner.setPointerCapture(event.pointerId);
    } catch (err) {
      /* capture is an improvement, not a requirement */
    }
    // The fill is the only feedback that the hold is registering. It is still
    // unlabelled and still takes the full two seconds.
    corner.classList.add('is-pressing');
    pressTimer = setTimeout(() => {
      endPress();
      navigate('caregiver-dashboard');
    }, LONG_PRESS_MS);
  });
  corner.addEventListener('pointerup', endPress);
  corner.addEventListener('pointercancel', endPress);
  corner.addEventListener('contextmenu', (event) => event.preventDefault());

  // Demo-only: a plain, labelled way across, for presenting on a device where a
  // two-second hold is awkward to do one-handed in front of an audience. It
  // exists only when the app is opened with ?caregiver=1, so a patient can
  // never meet it and the shipped behaviour is unchanged.
  const demoDoor = location.search.indexOf('caregiver=1') !== -1
    ? el('button', {
        class: 'caregiver-demo-door',
        onclick: () => navigate('caregiver-dashboard'),
      }, content.entry.caregiverButton)
    : null;

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
    demoDoor,
  ]));

  showDueReminder(container, content, navigate);
}
