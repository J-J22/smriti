import { loadContent } from './core/content.js';
import { initStore, getSettings } from './core/store.js';
import { register, init } from './core/router.js';
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
  const content = await loadContent(getSettings().language);

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
}

bootstrap();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
