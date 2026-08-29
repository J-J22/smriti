/* Service worker. Precache the whole app — shell, content pack and every
   image — so the very first session offline is identical to the first
   session online. Cache-first: airplane mode is the normal case here. */

var VERSION = 'smriti-v1';

var PRECACHE = [
  'index.html',
  'manifest.json',

  'css/base.css',
  'css/patient.css',

  'js/app.js',
  'js/core/bus.js',
  'js/core/dom.js',
  'js/core/content.js',
  'js/core/voice.js',
  'js/core/store.js',
  'js/core/adaptive.js',
  'js/core/session.js',
  'js/core/machine.js',
  'js/screens/home.js',
  'js/screens/intro.js',
  'js/screens/game-reminiscence.js',
  'js/screens/praise.js',

  'content/en.json',

  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',

  'assets/images/scene-tea.svg',
  'assets/images/scene-rain.svg',
  'assets/images/scene-garden.svg',
  'assets/images/scene-evening.svg',
  'assets/images/scene-home.svg',
  'assets/images/obj-teapot.svg',
  'assets/images/obj-bicycle.svg',
  'assets/images/obj-umbrella.svg',
  'assets/images/obj-radio.svg',
  'assets/images/obj-flower.svg',
  'assets/images/obj-cup.svg',
  'assets/images/obj-house.svg',
  'assets/images/obj-dog.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (cache) {
      // addAll is all-or-nothing; add one by one so a single miss can't
      // leave the device with no offline copy at all.
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' }))['catch'](function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === VERSION ? null : caches['delete'](k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) {
        // Refresh in the background; the patient never waits on the network.
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(VERSION).then(function (c) { c.put(req, res); });
        })['catch'](function () {});
        return hit;
      }
      return fetch(req)['catch'](function () {
        return caches.match('index.html');
      });
    })
  );
});
