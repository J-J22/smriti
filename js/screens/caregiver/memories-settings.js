import { el } from '../../core/dom.js';
import { backButton } from '../shared.js';
import {
  getMemories,
  addMemory,
  deleteMemory,
  getSettings,
  setSettings,
  applyBaselineDifficulty,
} from '../../core/store.js';

// Photos are stored inline as data URLs, so they are downscaled first: a phone
// camera JPEG would otherwise be several megabytes per photo.
const MAX_EDGE = 640;
const JPEG_QUALITY = 0.75;

function readAndShrink(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('image decode failed'));
      image.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch (err) {
          resolve(reader.result); // e.g. an SVG the canvas refuses to export
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function renderMemoriesSettings(container, params, navigate, content) {
  const c = content.caregiver.memoriesSettings;

  function repaint() {
    container.innerHTML = '';
    renderMemoriesSettings(container, params, navigate, content);
  }

  container.appendChild(el('div', { class: 'caregiver-screen' }, [
    el('h1', {}, c.title),

    el('h2', {}, c.photosHeading),
    el('p', { class: 'section-intro' }, c.photosIntro),
    renderPhotoForm(c, repaint),
    renderPhotoList(c, repaint),

    el('h2', {}, c.settingsHeading),
    renderLanguageSetting(content, c),
    renderDifficultySetting(c, repaint),

    el('p', { class: 'privacy-note' }, c.privacyNote),
    backButton(navigate, 'caregiver-dashboard', content),
  ]));
}

function renderPhotoForm(c, repaint) {
  const fileInput = el('input', { type: 'file', accept: 'image/*', id: 'photo-file' });
  const nameInput = el('input', {
    type: 'text', id: 'photo-name', placeholder: c.namePlaceholder,
  });
  const preview = el('img', { class: 'photo-preview', alt: '' });
  preview.hidden = true;
  const error = el('p', { class: 'form-error', 'aria-live': 'polite' }, '');

  let pendingImage = null;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    error.textContent = '';
    readAndShrink(file).then((dataUrl) => {
      pendingImage = dataUrl;
      preview.src = dataUrl;
      preview.hidden = false;
    }).catch(() => {
      error.textContent = c.photoRequired;
    });
  });

  function save() {
    const name = nameInput.value.trim();
    if (!pendingImage) { error.textContent = c.photoRequired; return; }
    if (!name) { error.textContent = c.nameRequired; nameInput.focus(); return; }
    addMemory({ name: name, image: pendingImage });
    repaint();
  }

  return el('div', { class: 'photo-form' }, [
    el('div', { class: 'field' }, [
      el('label', { for: 'photo-file' }, c.choosePhoto),
      fileInput,
    ]),
    preview,
    el('div', { class: 'field' }, [
      el('label', { for: 'photo-name' }, c.nameLabel),
      nameInput,
    ]),
    error,
    el('button', { class: 'big-btn', onclick: save }, c.savePhoto),
  ]);
}

function renderPhotoList(c, repaint) {
  const memories = getMemories();
  if (!memories.length) return el('p', { class: 'empty-state' }, c.noPhotos);

  return el('ul', { class: 'photo-list' }, memories.map((memory) =>
    el('li', { class: 'photo-row' }, [
      el('img', { src: memory.image, alt: '' }),
      el('span', { class: 'photo-name' }, memory.name),
      el('button', {
        class: 'danger-btn is-small',
        onclick: () => {
          if (!window.confirm(c.confirmDeletePhoto)) return;
          deleteMemory(memory.id);
          repaint();
        },
      }, c.deletePhoto),
    ])));
}

function renderLanguageSetting(content, c) {
  const languages = content.app.languages || { en: 'English' };
  const current = getSettings().language;
  const select = el('select', { id: 'setting-language' },
    Object.keys(languages).map((code) => el('option', { value: code }, languages[code])));
  select.value = languages[current] ? current : 'en';
  // A new pack is a drop-in: content/<code>.json plus an entry in app.languages.
  select.addEventListener('change', () => {
    setSettings({ language: select.value });
    window.location.reload();
  });

  return el('div', { class: 'setting-row' }, [
    el('div', { class: 'setting-text' }, [
      el('label', { for: 'setting-language' }, c.language),
      el('span', { class: 'setting-note' }, c.languageNote),
    ]),
    select,
  ]);
}

function renderDifficultySetting(c, repaint) {
  const current = getSettings().baselineDifficulty;
  const buttons = c.levels.map((label, index) => {
    const level = index + 1;
    return el('button', {
      class: level === current ? 'toggle-btn is-active' : 'toggle-btn',
      onclick: () => {
        applyBaselineDifficulty(level);
        repaint();
      },
    }, label);
  });

  return el('div', { class: 'setting-row' }, [
    el('div', { class: 'setting-text' }, [
      el('span', { class: 'setting-label' }, c.difficulty),
      el('span', { class: 'setting-note' }, c.difficultyNote),
    ]),
    el('div', { class: 'toggle-group' }, buttons),
  ]);
}
