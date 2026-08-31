// Reads the stored history into the shapes the caregiver screens display.
// Pure functions: callers pass the data in, which keeps this testable and
// keeps the reporting honest — nothing here touches the store or invents data.
//
// Claim discipline: everything computed here describes ACTIVITY PERFORMANCE.
// Nothing infers a cognitive state, and no output may be phrased as one.

const DAY = 86400000;

export function startOfDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
}

// One bucket per day, oldest first, so a bar chart can render it directly.
export function sessionsPerDay(sessions, days, now) {
  const today = startOfDay(now || Date.now());
  const counts = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = today - i * DAY;
    const count = sessions.filter((session) =>
      startOfDay(session.ts) === dayStart).length;
    counts.push({ ts: dayStart, value: count });
  }
  return counts;
}

// First-try accuracy as a percentage, in equal buckets across the history, so
// a short history still produces a readable trend.
export function accuracyTrend(rounds, buckets) {
  if (!rounds.length) return [];
  const size = Math.max(1, Math.ceil(rounds.length / buckets));
  const points = [];
  for (let start = 0; start < rounds.length; start += size) {
    const slice = rounds.slice(start, start + size);
    const correct = slice.filter((round) => round.correct).length;
    points.push(Math.round((correct / slice.length) * 100));
  }
  return points;
}

// What the model expected, bucketed exactly like accuracyTrend so the two lines
// can be read against each other. The prediction tracking the outcome is what
// "the learner is working" actually looks like.
export function expectedTrend(rounds, buckets) {
  const predicted = rounds.filter((round) => typeof round.expected === 'number');
  if (!predicted.length) return [];
  const size = Math.max(1, Math.ceil(predicted.length / buckets));
  const points = [];
  for (let start = 0; start < predicted.length; start += size) {
    const slice = predicted.slice(start, start + size);
    let sum = 0;
    for (const round of slice) sum += round.expected;
    points.push(Math.round((sum / slice.length) * 100));
  }
  return points;
}

export function levelTrend(rounds, buckets) {
  if (!rounds.length) return [];
  const size = Math.max(1, Math.ceil(rounds.length / buckets));
  const points = [];
  for (let start = 0; start < rounds.length; start += size) {
    const slice = rounds.slice(start, start + size);
    points.push(slice[slice.length - 1].difficulty);
  }
  return points;
}

// Consecutive days ending today (or yesterday) with at least one session.
export function practiceStreak(sessions, now) {
  if (!sessions.length) return 0;
  const days = {};
  for (const session of sessions) days[startOfDay(session.ts)] = true;
  const today = startOfDay(now || Date.now());
  let streak = 0;
  let cursor = days[today] ? today : today - DAY;
  if (!days[cursor]) return 0;
  while (days[cursor]) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

export function daysSinceLastSession(sessions, now) {
  if (!sessions.length) return null;
  const last = sessions[sessions.length - 1].ts;
  return daysBetween(last, now || Date.now());
}

/* ---------------------------------------------------------------
   Alerts. Descriptive only: each one states something that happened,
   never what it might mean about the person.
   --------------------------------------------------------------- */

const QUIET_DAYS = 3;
const STRUGGLE_ROUNDS = 6;
const STRUGGLE_RATE = 0.4;

export function buildAlerts(data) {
  const now = data.now || Date.now();
  const strings = data.strings;
  const names = data.exerciseNames || {};
  const alerts = [];

  const quietFor = daysSinceLastSession(data.sessions || [], now);
  if (quietFor === null) {
    alerts.push({ level: 'info', text: strings.noSessionsYet });
  } else if (quietFor >= QUIET_DAYS) {
    alerts.push({
      level: 'warn',
      text: strings.noActivity.replace('{n}', String(quietFor)),
    });
  }

  const missed = (data.reminders || []).filter((reminder) => reminder.overdue).length;
  if (missed > 0) {
    alerts.push({
      level: 'warn',
      text: (missed === 1 ? strings.missedOne : strings.missedMany)
        .replace('{n}', String(missed)),
    });
  }

  for (const id of Object.keys(data.engagement || {})) {
    const record = data.engagement[id];
    const name = names[id] || id;
    if (!record || !record.rounds || !record.rounds.length) continue;

    const recent = record.rounds.slice(-STRUGGLE_ROUNDS);
    const rate = recent.filter((round) => round.correct).length / recent.length;
    if (recent.length >= STRUGGLE_ROUNDS && rate < STRUGGLE_RATE) {
      alerts.push({
        level: 'warn',
        text: strings.harderLately.replace('{exercise}', name),
      });
    } else if (record.lastChange === 'up') {
      alerts.push({
        level: 'good',
        text: strings.movedUp.replace('{exercise}', name),
      });
    }
  }

  return alerts;
}
