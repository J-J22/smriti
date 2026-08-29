/* The content pack IS the app's copy. No string is ever hardcoded in a screen.
   Adding a language = drop in content/<code>.json and change one setting. */
(function (S) {
  'use strict';

  var pack = null;
  var code = 'en';

  function dig(path) {
    var parts = String(path).split('.');
    var node = pack;
    for (var i = 0; i < parts.length && node != null; i++) node = node[parts[i]];
    return node;
  }

  var Content = {
    load: function (lang) {
      code = lang || 'en';
      return fetch('content/' + code + '.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('content pack ' + code + ' missing');
          return r.json();
        })
        .then(function (json) { pack = json; return json; });
    },

    lang: function () { return code; },
    pack: function () { return pack; },

    /* t('ui.begin') → string. Arrays return one random member, so praise and
       redirection lines never sound canned two sessions running. */
    t: function (path, vars) {
      var v = dig(path);
      if (v == null) return '';
      if (Object.prototype.toString.call(v) === '[object Array]') {
        v = v[Math.floor(Math.random() * v.length)];
      }
      return typeof v === 'string' ? Content.fill(v, vars) : v;
    },

    get: function (path) { return dig(path); },

    fill: function (str, vars) {
      if (!vars) return str;
      return String(str).replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] != null ? vars[k] : m;
      });
    },

    greeting: function (now) {
      var h = (now || new Date()).getHours();
      if (h < 12) return Content.t('ui.greetingMorning');
      if (h < 17) return Content.t('ui.greetingAfternoon');
      return Content.t('ui.greetingEvening');
    },

    /* Spoken and written date, e.g. "Saturday, the 29th of August". */
    longDate: function (now) {
      var d = now || new Date();
      var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      var months = ['January','February','March','April','May','June','July',
                    'August','September','October','November','December'];
      var n = d.getDate();
      var suffix = (n % 10 === 1 && n !== 11) ? 'st'
                 : (n % 10 === 2 && n !== 12) ? 'nd'
                 : (n % 10 === 3 && n !== 13) ? 'rd' : 'th';
      return days[d.getDay()] + ', the ' + n + suffix + ' of ' + months[d.getMonth()];
    }
  };

  S.content = Content;
})(window.Smriti = window.Smriti || {});
