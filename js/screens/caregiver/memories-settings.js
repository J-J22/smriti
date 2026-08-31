import { el } from '../../core/dom.js';
import { backButton } from '../shared.js';
import { voiceStatus } from '../../core/voice.js';
import {
  clearAll,
  exportData,
  importData,
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
    renderSampleBanner(c),

    el('h2', {}, c.photosHeading),
    el('p', { class: 'section-intro' }, c.photosIntro),
    renderPhotoForm(c, repaint),
    renderPhotoList(c, repaint),

    el('h2', {}, c.settingsHeading),
    renderLanguageSetting(content, c),
    renderVoiceStatus(content, c),
    renderDifficultySetting(c, repaint),

    el('h2', {}, c.dataHeading),
    renderBackup(c),

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

// Says plainly what this device can actually speak. A regional language with
// no installed voice is the most likely thing to be missing in the field, and
// silently falling back would leave the caregiver guessing.
function renderVoiceStatus(content, c) {
  const status = voiceStatus();
  const languages = content.app.languages || {};
  const current = document.documentElement.lang || 'en';
  const languageName = languages[current] || current;

  let text;
  // Recorded lines carry every patient screen, so say that first: it is what
  // the patient will actually hear, whatever engine the device does or does
  // not have installed.
  if (status.recorded) text = c.voiceRecorded.replace('{n}', String(status.recorded));
  else if (!status.available) text = c.voiceNone;
  else if (status.exact) text = c.voiceExact.replace('{name}', status.name);
  else {
    text = c.voiceFallback
      .replace('{language}', languageName)
      .replace('{name}', status.name);
  }

  return el('div', { class: 'setting-row' }, [
    el('div', { class: 'setting-text' }, [
      el('span', { class: 'setting-label' }, c.voiceLabel),
      el('span', { class: 'setting-note' }, text),
    ]),
    el('span', {
      class: status.available ? 'status-dot is-ok' : 'status-dot',
      'aria-hidden': 'true',
    }),
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

// Backup is the honest version of "sync for remote areas": a file the caregiver
// controls, moved by hand, with no server and no account. Everything the store
// holds goes in, and restoring puts it back on any device running the app.
function renderBackup(c) {
  const status = el('p', { class: 'form-error', 'aria-live': 'polite' }, '');
  const fileInput = el('input', {
    type: 'file', accept: 'application/json,.json', id: 'restore-file',
  });

  function save() {
    const payload = JSON.stringify({
      app: 'smriti',
      version: 1,
      savedAt: new Date().toISOString(),
      data: exportData(),
    });
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const link = el('a', { href: url, download: c.exportName + '-' + stamp + '.json' });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Give the download a moment to start before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => { status.textContent = c.importFailed; };
    reader.onload = () => {
      let parsed = null;
      try {
        parsed = JSON.parse(reader.result);
      } catch (err) {
        parsed = null;
      }
      if (!parsed || parsed.app !== 'smriti' || !parsed.data) {
        status.textContent = c.importFailed;
        return;
      }
      if (!window.confirm(c.importConfirm)) return;
      importData(parsed.data).then(() => {
        status.textContent = c.importDone;
        window.location.reload();
      }).catch(() => {
        status.textContent = c.importFailed;
      });
    };
    reader.readAsText(file);
  });

  return el('div', { class: 'backup-block' }, [
    el('p', { class: 'section-intro' }, c.dataIntro),
    el('button', { class: 'big-btn is-secondary', onclick: save }, c.exportButton),
    el('div', { class: 'field' }, [
      el('label', { for: 'restore-file' }, c.importButton),
      fileInput,
    ]),
    status,
  ]);
}

// Says outright that what is on screen is example data. Leaving a demo device
// silently full of invented history would misrepresent a real person's record.
function renderSampleBanner(c) {
  if (!getSettings().sampleData) return null;
  return el('div', { class: 'sample-banner' }, [
    el('h2', {}, c.sampleHeading),
    el('p', {}, c.sampleNote),
    el('button', {
      class: 'danger-btn',
      onclick: () => {
        if (!window.confirm(c.sampleConfirm)) return;
        clearAll().then(() => window.location.reload());
      },
    }, c.sampleClear),
  ]);
}
