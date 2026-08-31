// Local-only persistence. IndexedDB is the real store (photos as data URLs can
// run to megabytes, well past the localStorage cap); localStorage is a mirror
// fallback for old Android browsers where IndexedDB is missing or blocked.
//
// All data stays on this one device. No accounts, no sync, no network.
//
// Reads are synchronous against an in-memory cache hydrated once by initStore(),
// so screens can render without awaiting. Writes update the cache immediately
// and persist in the background through a serialised queue.

import { initialState, nextState, clampLevel } from './adaptive.js';

const DB_NAME = 'smriti';
const DB_VERSION = 1;
const OBJECT_STORE = 'kv';
const LS_PREFIX = 'smriti:';

export const COLLECTIONS = ['reminders', 'memories', 'engagement', 'settings', 'activity'];
export const EXERCISE_IDS = ['exercise-1', 'exercise-2', 'exercise-3', 'exercise-4', 'exercise-5'];
const MAX_ROUNDS_KEPT = 60;
const MAX_SESSIONS_KEPT = 30;

function defaults() {
  return {
    reminders: [],
    memories: [],
    engagement: { exercises: {}, sessions: [] },
    settings: { language: 'en', baselineDifficulty: 1, sampleData: false },
    activity: { lastActiveAt: null, reminderLog: [] },
  };
}

let db = null;
let cache = null;
let ready = null;
let writeQueue = Promise.resolve();

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OBJECT_STORE)) {
        database.createObjectStore(OBJECT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexedDB open failed'));
    request.onblocked = () => reject(new Error('indexedDB blocked'));
  });
}

function idbRead(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OBJECT_STORE, 'readonly');
    const request = tx.objectStore(OBJECT_STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbWrite(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OBJECT_STORE, 'readwrite');
    tx.objectStore(OBJECT_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function lsRead(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch (err) {
    return undefined;
  }
}

function lsWrite(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

// Fills in anything a older/partial saved payload is missing.
function hydrateCollection(key, stored) {
  const base = defaults()[key];
  if (stored == null) return base;
  if (Array.isArray(base)) return Array.isArray(stored) ? stored : base;
  return { ...base, ...stored };
}

export async function initStore() {
  if (ready) return ready;
  ready = (async () => {
    cache = defaults();
    try {
      db = await openDB();
    } catch (err) {
      db = null;
    }
    for (const key of COLLECTIONS) {
      let stored;
      if (db) {
        try {
          stored = await idbRead(key);
        } catch (err) {
          stored = undefined;
        }
      }
      if (stored === undefined) stored = lsRead(key);
      cache[key] = hydrateCollection(key, stored);
    }
    cache.settings.baselineDifficulty = clampLevel(cache.settings.baselineDifficulty);
    return cache;
  })();
  return ready;
}

// True for a device with nothing on it — used to decide whether to seed the
// sample data on first run.
export function isFirstRun() {
  const state = requireCache();
  return state.reminders.length === 0 &&
    state.memories.length === 0 &&
    state.engagement.sessions.length === 0 &&
    !state.activity.lastActiveAt;
}

export function isReady() {
  return cache !== null;
}

// True when IndexedDB is carrying the data; false means we are on the fallback.
export function usingIndexedDB() {
  return db !== null;
}

function requireCache() {
  if (!cache) throw new Error('store not initialised — await initStore() first');
  return cache;
}

function persist(key) {
  const value = cache[key];
  lsWrite(key, value);
  writeQueue = writeQueue.then(async () => {
    if (!db) return;
    try {
      await idbWrite(key, value);
    } catch (err) {
      /* fallback mirror already written */
    }
  });
  return writeQueue;
}

// Exposed so callers that care (tests, teardown) can await the flush.
export function flush() {
  return writeQueue;
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* ---------- reminders ---------- */

function reminderSortKey(reminder) {
  return String(reminder.time || '');
}

export function getReminders() {
  return clone(requireCache().reminders).sort((a, b) =>
    reminderSortKey(a).localeCompare(reminderSortKey(b))
  );
}

export function getReminder(id) {
  const found = requireCache().reminders.find((r) => r.id === id);
  return found ? clone(found) : null;
}

export function addReminder({ type, time, label = '' }) {
  const reminder = {
    id: newId('rem'),
    type: String(type || 'medicine'),
    time: String(time || ''),
    label: String(label || ''),
    createdAt: Date.now(),
    lastDoneAt: null,
  };
  requireCache().reminders.push(reminder);
  persist('reminders');
  return clone(reminder);
}

export function updateReminder(id, patch) {
  const list = requireCache().reminders;
  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return null;
  list[index] = { ...list[index], ...patch, id };
  persist('reminders');
  return clone(list[index]);
}

export function deleteReminder(id) {
  const list = requireCache().reminders;
  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  persist('reminders');
  return true;
}

// "HH:MM" -> minutes since midnight, or null if unparseable.
export function timeToMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function sameDay(a, b) {
  const first = new Date(a);
  const second = new Date(b);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function isDoneToday(reminder, now = Date.now()) {
  return Boolean(reminder.lastDoneAt && sameDay(reminder.lastDoneAt, now));
}

// The next reminder still ahead today, ignoring ones already marked done.
export function getNextReminder(now = new Date()) {
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const upcoming = getReminders()
    .filter((r) => timeToMinutes(r.time) !== null && !isDoneToday(r, now.getTime()))
    .filter((r) => timeToMinutes(r.time) >= minutesNow);
  return upcoming.length ? upcoming[0] : null;
}

// Reminders whose time has arrived today and that have not been dismissed yet.
export function getDueReminders(now = new Date()) {
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return getReminders().filter((r) => {
    const minutes = timeToMinutes(r.time);
    return minutes !== null && minutes <= minutesNow && !isDoneToday(r, now.getTime());
  });
}

export function markReminderDone(id, now = Date.now()) {
  const updated = updateReminder(id, { lastDoneAt: now });
  if (!updated) return null;
  const activity = requireCache().activity;
  activity.reminderLog.push({ reminderId: id, ts: now });
  if (activity.reminderLog.length > 200) {
    activity.reminderLog = activity.reminderLog.slice(-200);
  }
  persist('activity');
  return updated;
}

export function getReminderLog() {
  return clone(requireCache().activity.reminderLog);
}

/* ---------- memories (photos) ---------- */

export function getMemories() {
  return clone(requireCache().memories);
}

export function addMemory({ name, image }) {
  const memory = {
    id: newId('mem'),
    name: String(name || '').trim(),
    image: String(image || ''),
    createdAt: Date.now(),
  };
  requireCache().memories.push(memory);
  persist('memories');
  return clone(memory);
}

export function updateMemory(id, patch) {
  const list = requireCache().memories;
  const index = list.findIndex((m) => m.id === id);
  if (index === -1) return null;
  list[index] = { ...list[index], ...patch, id };
  persist('memories');
  return clone(list[index]);
}

export function deleteMemory(id) {
  const list = requireCache().memories;
  const index = list.findIndex((m) => m.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  persist('memories');
  return true;
}

/* ---------- settings ---------- */

export function getSettings() {
  return clone(requireCache().settings);
}

// Setting the baseline is the caregiver saying "start here" — so it also
// resets each exercise's current level, keeping the history intact.
export function applyBaselineDifficulty(level) {
  const settings = setSettings({ baselineDifficulty: level });
  const exercises = requireCache().engagement.exercises;
  for (const id of Object.keys(exercises)) {
    exercises[id].difficulty = settings.baselineDifficulty;
    exercises[id].correctStreak = 0;
    exercises[id].wrongStreak = 0;
    exercises[id].lastChange = null;
  }
  persist('engagement');
  return settings;
}

export function setSettings(patch) {
  const settings = requireCache().settings;
  Object.assign(settings, patch);
  if ('baselineDifficulty' in patch) {
    settings.baselineDifficulty = clampLevel(settings.baselineDifficulty);
  }
  persist('settings');
  return clone(settings);
}

/* ---------- engagement + adaptive state ---------- */

function exerciseRecord(exerciseId) {
  const engagement = requireCache().engagement;
  if (!engagement.exercises[exerciseId]) {
    engagement.exercises[exerciseId] = {
      ...initialState(requireCache().settings.baselineDifficulty),
      rounds: [],
      totalRounds: 0,
      totalCorrect: 0,
    };
  }
  return engagement.exercises[exerciseId];
}

// Current adaptive level for an exercise, seeded from the caregiver baseline.
export function getDifficulty(exerciseId) {
  return clampLevel(exerciseRecord(exerciseId).difficulty);
}

export function getEngagement(exerciseId) {
  return clone(exerciseRecord(exerciseId));
}

export function getAllEngagement() {
  const out = {};
  for (const id of EXERCISE_IDS) out[id] = getEngagement(id);
  return out;
}

// One answered round. Applies the adaptive rules and persists the new state.
export function recordRound(exerciseId, { correct, promptId = null, attempts = 1 }) {
  const record = exerciseRecord(exerciseId);
  const advanced = nextState(record, Boolean(correct));

  record.difficulty = advanced.difficulty;
  record.correctStreak = advanced.correctStreak;
  record.wrongStreak = advanced.wrongStreak;
  record.lastChange = advanced.lastChange;
  record.totalRounds += 1;
  if (correct) record.totalCorrect += 1;
  record.rounds.push({
    ts: Date.now(),
    correct: Boolean(correct),
    promptId,
    attempts,
    difficulty: advanced.difficulty,
    change: advanced.lastChange,
  });
  if (record.rounds.length > MAX_ROUNDS_KEPT) {
    record.rounds = record.rounds.slice(-MAX_ROUNDS_KEPT);
  }

  persist('engagement');
  touchActivity();
  return clone(record);
}

export function recordSession({ completed = 0, startedAt = null } = {}) {
  const engagement = requireCache().engagement;
  engagement.sessions.push({
    ts: Date.now(),
    startedAt: startedAt || Date.now(),
    completed,
  });
  if (engagement.sessions.length > MAX_SESSIONS_KEPT) {
    engagement.sessions = engagement.sessions.slice(-MAX_SESSIONS_KEPT);
  }
  persist('engagement');
  touchActivity();
  return clone(engagement.sessions[engagement.sessions.length - 1]);
}

export function getSessions() {
  return clone(requireCache().engagement.sessions);
}

/* ---------- activity ---------- */

export function touchActivity(now = Date.now()) {
  requireCache().activity.lastActiveAt = now;
  persist('activity');
  return now;
}

export function getLastActiveAt() {
  return requireCache().activity.lastActiveAt;
}

/* ---------- maintenance ---------- */

export async function clearAll() {
  cache = defaults();
  // A deliberate wipe is not a fresh install: leave a marker so the first-run
  // sample data does not immediately reappear.
  cache.activity.lastActiveAt = Date.now();
  for (const key of COLLECTIONS) {
    try {
      localStorage.removeItem(LS_PREFIX + key);
    } catch (err) {
      /* ignore */
    }
    if (db) {
      try {
        await idbWrite(key, undefined);
      } catch (err) {
        /* ignore */
      }
    }
  }
  return cache;
}

// Whole-device snapshot. Also the honest basis for a future backup/restore.
export function exportData() {
  const out = {};
  for (const key of COLLECTIONS) out[key] = clone(requireCache()[key]);
  return out;
}

// Replaces whole collections at once. Used by the demo seeder, which needs to
// write back-dated history that the normal write path cannot produce.
export async function importData(payload) {
  requireCache();
  for (const key of COLLECTIONS) {
    if (payload[key] === undefined) continue;
    cache[key] = hydrateCollection(key, payload[key]);
    persist(key);
  }
  await flush();
  return exportData();
}

// Debug hook: lets the self-test page drop the in-memory cache and re-hydrate
// from disk without a page reload.
export async function reloadFromDisk() {
  await flush();
  cache = null;
  ready = null;
  db = null;
  return initStore();
}
