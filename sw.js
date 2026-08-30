const CACHE_NAME = 'smriti-shell-v6';

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
