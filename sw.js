const CACHE_NAME = 'smriti-shell-v13';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/patient.css',
  './css/caregiver.css',
  './content/en.json',
  './content/as.json',
  './js/app.js',
  './js/core/router.js',
  './js/core/dom.js',
  './js/core/content.js',
  './js/core/voice.js',
  './js/core/store.js',
  './js/core/adaptive.js',
  './js/core/model.js',
  './js/core/listen.js',
  './js/core/demo-data.js',
  './js/core/format.js',
  './js/core/analytics.js',
  './js/core/chart.js',
  './js/screens/shared.js',
  './js/screens/entry.js',
  './js/screens/patient/home.js',
  './js/screens/patient/reminder-card.js',
  './js/screens/patient/today.js',
  './js/screens/patient/memories.js',
  './js/screens/patient/exercises.js',
  './js/screens/caregiver/dashboard.js',
  './js/screens/caregiver/alerts.js',
  './js/screens/caregiver/overview.js',
  './js/screens/caregiver/reminders.js',
  './js/screens/caregiver/engagement.js',
  './js/screens/caregiver/memories-settings.js',
  './assets/icons/icon.svg',
  './assets/icons/nav-today.svg',
  './assets/icons/nav-exercise.svg',
  './assets/icons/nav-memories.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/images/obj-bamboo-house.svg',
  './assets/images/obj-basket.svg',
  './assets/images/obj-bicycle.svg',
  './assets/images/obj-boat.svg',
  './assets/images/obj-cup.svg',
  './assets/images/obj-dhol.svg',
  './assets/images/obj-dog.svg',
  './assets/images/obj-flower.svg',
  './assets/images/obj-gamosa.svg',
  './assets/images/obj-hornbill.svg',
  './assets/images/obj-house.svg',
  './assets/images/obj-jaapi.svg',
  './assets/images/obj-meal.svg',
  './assets/images/obj-medicine.svg',
  './assets/images/obj-moon.svg',
  './assets/images/obj-orange.svg',
  './assets/images/obj-radio.svg',
  './assets/images/obj-rice.svg',
  './assets/images/obj-sunrise.svg',
  './assets/images/obj-tamul.svg',
  './assets/images/obj-tealeaf.svg',
  './assets/images/obj-teapot.svg',
  './assets/images/obj-umbrella.svg',
  './assets/images/obj-walk.svg',
  './assets/images/obj-water.svg',
  './assets/images/obj-xorai.svg',
  './assets/images/scene-evening.svg',
  './assets/images/scene-festival.svg',
  './assets/images/scene-garden.svg',
  './assets/images/scene-home.svg',
  './assets/images/scene-paddy.svg',
  './assets/images/scene-rain.svg',
  './assets/images/scene-river.svg',
  './assets/images/scene-tea-garden.svg',
  './assets/images/scene-tea.svg',
  './assets/images/scene-village.svg',
];

// Pre-rendered speech, listed by the build in assets/audio/<lang>/index.json.
// Read at install time rather than hard-coded here, so re-running
// tools/build-voice.py never leaves this file out of date.
//
// Only English is precached up front. The Assamese set is the same size again,
// and a device that never switches language should not pay for it on a rural
// connection — the fetch handler caches those clips the first time they play,
// and until then that language simply speaks live.
const AUDIO_INDEXES = ['./assets/audio/en/index.json'];

async function precacheAudio(cache) {
  for (const indexPath of AUDIO_INDEXES) {
    try {
      const response = await fetch(indexPath);
      if (!response.ok) continue;
      const index = await response.json();
      await cache.put(indexPath, new Response(JSON.stringify(index), {
        headers: { 'Content-Type': 'application/json' },
      }));

      const dir = indexPath.slice(0, indexPath.lastIndexOf('/') + 1);
      const files = Array.from(new Set(
        Object.keys(index).map((line) => dir + index[line].f)));
      // One at a time with its own catch: addAll() throws away the whole batch
      // if a single file is missing, and silence is worse than a gap.
      for (const file of files) {
        await cache.add(file).catch(() => {});
      }
    } catch (err) {
      /* audio is an enhancement — the app speaks live without it */
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      await precacheAudio(cache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Audio for a language that was not precached is kept the first time it
        // plays, so switching language is a one-off cost rather than a
        // permanent dependency on being online.
        if (response.ok && event.request.url.indexOf('/assets/audio/') !== -1) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
