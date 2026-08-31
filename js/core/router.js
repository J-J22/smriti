import { stopSpeaking } from './voice.js';
import { stopListening } from './listen.js';

const routes = {};
let currentParams = {};

export function register(name, renderFn) {
  routes[name] = renderFn;
}

export function navigate(name, params = {}) {
  currentParams = params;
  const hash = `#${name}`;
  if (location.hash === hash) {
    renderCurrent();
  } else {
    location.hash = hash;
  }
}

function renderCurrent() {
  const name = (location.hash || '').slice(1) || 'entry';
  const renderFn = routes[name];
  const app = document.getElementById('app');
  // A line belongs to the screen that started it. Leaving that screen ends it,
  // here rather than in each screen's own exit handler — otherwise a screen
  // that does not speak on entry (Patient Home, every caregiver screen) has
  // nothing to cancel the line still running underneath it.
  stopSpeaking();
  stopListening();
  app.innerHTML = '';
  if (!renderFn) {
    app.textContent = `Unknown screen: ${name}`;
    return;
  }
  renderFn(app, currentParams, navigate);
}

export function init(defaultRoute) {
  window.addEventListener('hashchange', renderCurrent);
  if (!location.hash) {
    navigate(defaultRoute);
  } else {
    renderCurrent();
  }
}
