/* Local persistence. IndexedDB when available, localStorage when not, memory
   as a last resort — the app must still run on an old browser in airplane
   mode with storage disabled. Nothing here ever leaves the device. */
(function (S) {
  'use strict';

  var DB = 'smriti', VER = 1;
  var db = null, mode = 'memory';
  var mem = { state: {}, sessions: [] };

  function idbReady() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) return resolve(false);
      var req;
      try { req = indexedDB.open(DB, VER); } catch (e) { return resolve(false); }
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains('state')) d.createObjectStore('state');
        if (!d.objectStoreNames.contains('sessions')) {
          d.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = function () { db = req.result; resolve(true); };
      req.onerror = function () { resolve(false); };
      // Private mode can hang the open call; don't let boot wait on it.
      setTimeout(function () { if (!db) resolve(false); }, 1500);
    });
  }

  function tx(store, write) {
    return db.transaction(store, write ? 'readwrite' : 'readonly').objectStore(store);
  }

  function wrap(req) {
    return new Promise(function (res, rej) {
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
    });
  }

  var Store = {
    init: function () {
      return idbReady().then(function (ok) {
        if (ok) { mode = 'idb'; return mode; }
        try {
          localStorage.setItem('smriti:probe', '1');
          localStorage.removeItem('smriti:probe');
          mode = 'local';
        } catch (e) { mode = 'memory'; }
        return mode;
      });
    },

    mode: function () { return mode; },

    getState: function (key, fallback) {
      if (mode === 'idb') {
        return wrap(tx('state').get(key))
          .then(function (v) { return v === undefined ? fallback : v; })
          .catch(function () { return fallback; });
      }
      if (mode === 'local') {
        try {
          var raw = localStorage.getItem('smriti:state:' + key);
          return Promise.resolve(raw == null ? fallback : JSON.parse(raw));
        } catch (e) { return Promise.resolve(fallback); }
      }
      return Promise.resolve(key in mem.state ? mem.state[key] : fallback);
    },

    setState: function (key, value) {
      if (mode === 'idb') {
        return wrap(tx('state', true).put(value, key)).catch(function () {});
      }
      if (mode === 'local') {
        try { localStorage.setItem('smriti:state:' + key, JSON.stringify(value)); } catch (e) {}
        return Promise.resolve();
      }
      mem.state[key] = value;
      return Promise.resolve();
    },

    addSession: function (record) {
      if (mode === 'idb') return wrap(tx('sessions', true).add(record)).catch(function () {});
      if (mode === 'local') {
        try {
          var all = JSON.parse(localStorage.getItem('smriti:sessions') || '[]');
          all.push(record);
          localStorage.setItem('smriti:sessions', JSON.stringify(all.slice(-200)));
        } catch (e) {}
        return Promise.resolve();
      }
      mem.sessions.push(record);
      return Promise.resolve();
    },

    listSessions: function () {
      if (mode === 'idb') return wrap(tx('sessions').getAll()).catch(function () { return []; });
      if (mode === 'local') {
        try { return Promise.resolve(JSON.parse(localStorage.getItem('smriti:sessions') || '[]')); }
        catch (e) { return Promise.resolve([]); }
      }
      return Promise.resolve(mem.sessions.slice());
    }
  };

  S.store = Store;
})(window.Smriti = window.Smriti || {});
