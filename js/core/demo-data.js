// Sample data for a device that has never been used.
//
// A cold install shows an empty state on every screen, which makes a working
// app look like a shell. On first run the app seeds this so it opens with
// something real on it. Everything goes through the normal store collections,
// so the app reads it exactly as if a caregiver had entered it by hand, and
// Caregiver Settings can clear it in one tap.

const DAY = 86400000;

// Placeholder portraits so the demo has photos without shipping real family
// pictures. Swap these for actual photos on the demo device.
function portrait(name, background, ink) {
  const initials = name.split(/\s+/).map((word) => word.charAt(0).toUpperCase())
    .join('').slice(0, 2);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">' +
    '<rect width="240" height="240" fill="' + background + '"/>' +
    '<circle cx="120" cy="96" r="46" fill="' + ink + '" opacity="0.85"/>' +
    '<path d="M40 240c0-46 36-78 80-78s80 32 80 78z" fill="' + ink + '" opacity="0.85"/>' +
    '<text x="120" y="112" font-family="system-ui,sans-serif" font-size="44" ' +
    'font-weight="700" fill="' + background + '" text-anchor="middle">' + initials + '</text>' +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const PEOPLE = [
  ['Ama', '#F3E2C7', '#8C5A2B'],
  ['Deuta', '#DCE8E6', '#2B6777'],
  ['Bipin', '#E9DDEC', '#5B3C6E'],
  ['Rina', '#F6DCDC', '#8C3B3B'],
  ['Our house', '#DFE9D6', '#4A6B33'],
];

function hhmm(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
}

function offsetTime(minutesFromNow) {
  return hhmm(new Date(Date.now() + minutesFromNow * 60000));
}

// A fortnight of practice that gets steadier over time, so the caregiver
// Engagement screen has a story to show instead of zeroes.
function buildEngagement(now) {
  const exercises = {};
  const sessions = [];
  const ids = ['exercise-1', 'exercise-2', 'exercise-3', 'exercise-4', 'exercise-5'];
  const state = {};
  for (const id of ids) {
    state[id] = { difficulty: 1, correctStreak: 0, wrongStreak: 0, lastChange: null,
      rounds: [], totalRounds: 0, totalCorrect: 0 };
  }

  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    if (daysAgo % 3 === 2) continue; // a few days without a session
    const day = now - daysAgo * DAY + 10 * 3600000;
    // Later days go better than earlier ones.
    const successRate = 0.45 + (13 - daysAgo) * 0.035;
    let completed = 0;

    for (const id of ids) {
      const record = state[id];
      const rounds = id === 'exercise-4' ? 1 : 2;
      for (let i = 0; i < rounds; i++) {
        const correct = Math.random() < successRate;
        if (correct) {
          record.correctStreak += 1;
          record.wrongStreak = 0;
          if (record.correctStreak >= 3) {
            record.correctStreak = 0;
            if (record.difficulty < 3) { record.difficulty += 1; record.lastChange = 'up'; }
          }
        } else {
          record.wrongStreak += 1;
          record.correctStreak = 0;
          if (record.wrongStreak >= 2) {
            record.wrongStreak = 0;
            record.lastChange = record.difficulty > 1 ? 'down' : 'repeat';
            if (record.difficulty > 1) record.difficulty -= 1;
          }
        }
        record.totalRounds += 1;
        if (correct) record.totalCorrect += 1;
        record.rounds.push({
          ts: day + i * 45000,
          correct: correct,
          promptId: null,
          attempts: correct ? 1 : 2,
          difficulty: record.difficulty,
          change: record.lastChange,
        });
        completed += 1;
      }
    }
    sessions.push({ ts: day + 400000, startedAt: day, completed: completed });
  }

  for (const id of ids) {
    exercises[id] = state[id];
    if (exercises[id].rounds.length > 60) {
      exercises[id].rounds = exercises[id].rounds.slice(-60);
    }
  }
  return { exercises: exercises, sessions: sessions };
}

// dueNow: seed one reminder whose time has already passed and is NOT marked
// done, so Patient Home opens with the due-reminder card.
export function buildDemoData(options) {
  const settings = options || {};
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reminders = [
    { id: 'rem-demo-1', type: 'medicine', time: '08:00', label: 'After breakfast',
      createdAt: now - 12 * DAY, lastDoneAt: today.getTime() + 8.2 * 3600000 },
    { id: 'rem-demo-2', type: 'hydration', time: '11:00', label: 'A glass of water',
      createdAt: now - 12 * DAY, lastDoneAt: today.getTime() + 11.1 * 3600000 },
    { id: 'rem-demo-3', type: 'activity', time: offsetTime(90), label: 'Evening walk',
      createdAt: now - 9 * DAY, lastDoneAt: null },
    { id: 'rem-demo-4', type: 'appointment', time: offsetTime(240), label: 'Dr. Baruah',
      createdAt: now - 4 * DAY, lastDoneAt: null },
  ];

  if (settings.dueNow) {
    reminders.push({ id: 'rem-demo-due', type: 'medicine', time: offsetTime(-15),
      label: 'Evening tablet', createdAt: now - DAY, lastDoneAt: null });
  }

  const memories = PEOPLE.map((person, index) => ({
    id: 'mem-demo-' + index,
    name: person[0],
    image: portrait(person[0], person[1], person[2]),
    createdAt: now - (PEOPLE.length - index) * DAY,
  }));

  return {
    sample: Boolean(settings.sample),
    reminders: reminders,
    memories: memories,
    engagement: buildEngagement(now),
    settings: { language: 'en', baselineDifficulty: 1,
      sampleData: Boolean(settings.sample) },
    activity: { lastActiveAt: now - 35 * 60000, reminderLog: [
      { reminderId: 'rem-demo-1', ts: today.getTime() + 8.2 * 3600000 },
      { reminderId: 'rem-demo-2', ts: today.getTime() + 11.1 * 3600000 },
    ] },
  };
}
