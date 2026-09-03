import { loadContent } from './core/content.js';
import { initStore, getSettings, isFirstRun, importData } from './core/store.js';
import { buildDemoData } from './core/demo-data.js';
import { setVoiceLanguage, loadVoiceClips, voiceLog, audibleCount } from './core/voice.js';
import { startReminderWatch } from './screens/patient/reminder-card.js';
import { register, init, navigate } from './core/router.js';
import { renderEntry } from './screens/entry.js';
import { renderPatientHome } from './screens/patient/home.js';
import { renderToday } from './screens/patient/today.js';
import { renderMemories } from './screens/patient/memories.js';
import { renderExercises } from './screens/patient/exercises.js';
import { renderCaregiverDashboard } from './screens/caregiver/dashboard.js';
import { renderOverview } from './screens/caregiver/overview.js';
import { renderReminders } from './screens/caregiver/reminders.js';
import { renderEngagement } from './screens/caregiver/engagement.js';
import { renderMemoriesSettings } from './screens/caregiver/memories-settings.js';

function withContent(renderFn, content) {
  return (container, params, navigate) => renderFn(container, params, navigate, content);
}

async function bootstrap() {
  // The store hydrates first: it holds the language the content pack is
  // chosen by, and every screen reads it synchronously after this point.
  await initStore();

  // A device that has never been used opens on empty states everywhere, which
  // reads as a broken app rather than a new one. Seed it once; Caregiver
  // Settings can clear it.
  if (isFirstRun()) {
    await importData(buildDemoData({ sample: true }));
  }

  const language = getSettings().language;
  const content = await loadContent(language);
  // Screen readers and the TTS engine both key off these.
  document.documentElement.lang = language;
  setVoiceLanguage(content.app.speechLang);
  // Pre-rendered lines for this language, if the build produced them. Missing
  // audio is not a failure: speak() falls back to the live engine per line.
  await loadVoiceClips(language);

  register('entry', withContent(renderEntry, content));
  register('patient-home', withContent(renderPatientHome, content));
  register('today', withContent(renderToday, content));
  register('memories', withContent(renderMemories, content));
  register('exercises', withContent(renderExercises, content));
  register('caregiver-dashboard', withContent(renderCaregiverDashboard, content));
  register('caregiver-overview', withContent(renderOverview, content));
  register('caregiver-reminders', withContent(renderReminders, content));
  register('caregiver-engagement', withContent(renderEngagement, content));
  register('caregiver-memories-settings', withContent(renderMemoriesSettings, content));

  init('entry');

  // Reminders arrive while the app is open, not only when Home is drawn.
  startReminderWatch(content, navigate);
}

bootstrap();

// Voice diagnostics. Only ever on with ?voicelog=1 in the URL, so it cannot
// appear during a demo. Reads the ring buffer voice.js keeps and shows it on
// screen, because the phone this has to be diagnosed on has no dev tools.
// Two or more audible at once is the overlap, caught in the act.
if (location.search.indexOf('voicelog') !== -1) {
  const panel = document.createElement('pre');
  panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:42vh;' +
    'overflow:hidden;margin:0;padding:6px 8px;z-index:9999;pointer-events:none;' +
    'font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;' +
    'background:rgba(20,18,16,.88);color:#e8e2d8';
  document.body.appendChild(panel);
  setInterval(() => {
    const audible = audibleCount();
    const lines = voiceLog().slice(-14)
      .map((e) => String(e.t).padStart(6) + '  ' + e.event.padEnd(10) + ' ' + e.detail);
    panel.textContent = (audible > 1 ? '### OVERLAP: ' + audible + ' CLIPS AUDIBLE ###\n' : '')
      + lines.join('\n');
    panel.style.background = audible > 1 ? 'rgba(120,20,15,.92)' : 'rgba(20,18,16,.88)';
  }, 250);
}

// The service worker exists to make a web page work offline. Inside the native
// package it has nothing to do — every asset already ships in the APK — and
// registering it anyway costs a full second copy of them: 7.9 MB of CacheStorage
// measured on a Galaxy A23, against an 11 MB package. So the native build skips
// it, and clears anything an earlier build left behind.
//
// `window.Capacitor` is undefined in a browser, so the web app is untouched.
if (window.Capacitor) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => registrations.forEach((r) => r.unregister()))
      .catch(() => {});
  }
  if (window.caches && caches.keys) {
    caches.keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .catch(() => {});
  }
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Ask the browser to keep this origin's storage.
//
// Without this, both the precached shell and IndexedDB are best-effort: Android
// may reclaim the whole origin under storage pressure, which on the ~1 GB
// devices this is built for is a real event, not a theoretical one. Eviction
// would take the patient's photos, reminders and session history with it, and
// the first anyone would know is a blank app.
//
// It is a request, not a guarantee — Chrome generally grants it to an installed
// PWA and may refuse otherwise. Nothing reads the answer and nothing changes if
// it is no, so the app neither waits on it nor reports it; the whole call is
// wrapped because an old Android browser may carry a partial StorageManager.
try {
  if (navigator.storage && navigator.storage.persist && navigator.storage.persisted) {
    navigator.storage.persisted()
      .then((already) => (already ? true : navigator.storage.persist()))
      .catch(() => false);
  }
} catch (err) {
  /* storage persistence is an optimisation; never let it break boot */
}
