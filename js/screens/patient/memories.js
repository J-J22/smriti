import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';
import { speak, stopSpeaking } from '../../core/voice.js';
import { getMemories, touchActivity } from '../../core/store.js';

export function renderMemories(container, params, navigate, content) {
  const c = content.patient.memories;
  const photos = getMemories();

  if (!photos.length) {
    speak(c.empty);
    container.appendChild(el('div', { class: 'patient-screen' }, [
      homeIcon(navigate, content, stopSpeaking),
      el('h1', {}, c.title),
      el('p', { class: 'exercise-lead' }, c.empty),
    ]));
    return;
  }

  const count = photos.length;
  const index = ((params.index || 0) % count + count) % count;
  const photo = photos[index];

  touchActivity();

  container.appendChild(el('div', { class: 'patient-screen memories-screen' }, [
    homeIcon(navigate, content, stopSpeaking),
    el('div', { class: 'memory-photo' }, [el('img', { src: photo.image, alt: '' })]),
    el('h1', { class: 'memory-name' }, photo.name),
    el('div', { class: 'nav-row' }, [
      el('button', {
        class: 'big-btn',
        onclick: () => navigate('memories', { index: index - 1 }),
      }, c.previous),
      el('button', {
        class: 'big-btn',
        onclick: () => navigate('memories', { index: index + 1 }),
      }, c.next),
    ]),
  ]));

  // Every photo is named aloud, the same way a person would.
  speak(photo.name);
}
