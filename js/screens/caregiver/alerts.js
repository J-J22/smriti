// Shared between Overview (the full list) and the Dashboard (a count badge),
// so both always agree about what needs attention.

import { el } from '../../core/dom.js';
import { buildAlerts } from '../../core/analytics.js';
import {
  getReminders,
  getSessions,
  getAllEngagement,
  isDoneToday,
  timeToMinutes,
} from '../../core/store.js';

export function currentAlerts(content) {
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  // A reminder counts as overdue only once its time has passed today.
  const reminders = getReminders().map((reminder) => {
    const minutes = timeToMinutes(reminder.time);
    return {
      id: reminder.id,
      overdue: minutes !== null && minutes < minutesNow && !isDoneToday(reminder, now.getTime()),
    };
  });

  return buildAlerts({
    now: now.getTime(),
    sessions: getSessions(),
    reminders: reminders,
    engagement: getAllEngagement(),
    exerciseNames: content.caregiver.engagement.exerciseNames,
    strings: content.caregiver.alerts,
  });
}

// Only the ones a caregiver should act on — the positive notes are context,
// not a to-do.
export function actionableCount(alerts) {
  return alerts.filter((alert) => alert.level === 'warn').length;
}

export function renderAlertList(content, alerts) {
  const c = content.caregiver.alerts;
  if (!alerts.length) {
    return el('div', { class: 'alert-list' }, [
      el('p', { class: 'alert is-good' }, c.none),
    ]);
  }
  return el('div', { class: 'alert-list' }, alerts.map((alert) =>
    el('p', { class: 'alert is-' + alert.level }, alert.text)));
}
