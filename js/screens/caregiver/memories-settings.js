import { el } from '../../core/dom.js';
import { backButton } from '../shared.js';

export function renderMemoriesSettings(container, params, navigate, content) {
  const c = content.caregiver.memoriesSettings;
  container.appendChild(
    el('div', { class: 'caregiver-screen' }, [
      el('h1', {}, c.title),
      el('button', { class: 'big-btn' }, c.addPhoto),
      el('div', { class: 'setting-row' }, [
        el('span', {}, c.language),
        el('button', { class: 'toggle-btn' }, c.languageValue),
      ]),
      el('div', { class: 'setting-row' }, [
        el('span', {}, c.difficulty),
        el('button', { class: 'toggle-btn' }, c.difficultyValue),
      ]),
      el('p', { class: 'privacy-note' }, c.privacyNote),
      backButton(navigate, 'caregiver-dashboard', content),
    ])
  );
}
