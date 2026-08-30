const CACHE_NAME = 'smriti-shell-v4';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/patient.css',
  './css/caregiver.css',
  './content/en.json',
  './js/app.js',
  './js/core/router.js',
  './js/core/dom.js',
  './js/core/content.js',
  './js/core/voice.js',
  './js/core/store.js',
  './js/core/adaptive.js',
  './js/core/format.js',
  './js/screens/shared.js',
  './js/screens/entry.js',
  './js/screens/patient/home.js',
  './js/screens/patient/today.js',
  './js/screens/patient/memories.js',
  './js/screens/patient/exercises.js',
  './js/screens/caregiver/dashboard.js',
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
  './assets/images/obj-bicycle.svg',
  './assets/images/obj-cup.svg',
  './assets/images/obj-dog.svg',
  './assets/images/obj-flower.svg',
  './assets/images/obj-house.svg',
  './assets/images/obj-radio.svg',
  './assets/images/obj-teapot.svg',
  './assets/images/obj-umbrella.svg',
  './assets/images/scene-evening.svg',
  './assets/images/scene-garden.svg',
  './assets/images/scene-home.svg',
  './assets/images/scene-rain.svg',
  './assets/images/scene-tea.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
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
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
