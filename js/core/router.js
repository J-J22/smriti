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
