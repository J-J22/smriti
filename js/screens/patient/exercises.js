// The exercises session: linear, voice-led, self-advancing. There is no Next
// button and no back navigation — the only way out is the Home icon. A round
// only advances once it has been resolved, so repeated taps can never skip it.

import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';
import { speak, stopSpeaking } from '../../core/voice.js';
import {
  getMemories,
  getDifficulty,
  recordRound,
  recordSession,
  touchActivity,
} from '../../core/store.js';

// Screens advance when the narration finishes, with these as the ceiling for
// a device that has no voice engine. Waiting a fixed four seconds after the
// voice has already stopped is what makes an app feel sluggish.
const INTRO_MS = 5200;
const CORRECT_MS = 2400;
const REVEAL_MS = 3800; // longer: the correct answer is being shown
const RETRY_MS = 1600;  // gentle pause before the patient may try again
const PRAISE_MS = 4600;
const AFTER_SPEECH_MS = 700; // a beat to let the screen settle

const SEQUENCE = ['exercise-1', 'exercise-2', 'exercise-3'];

// Guards against a timer from an abandoned session firing after the patient
// has already left the screen.
let activeToken = 0;

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Reads a per-level setting, clamping to whatever the content pack provides.
function byLevel(table, level) {
  const values = table && table.length ? table : [2];
  const index = Math.min(values.length, Math.max(1, level)) - 1;
  return values[index];
}

export function renderExercises(container, params, navigate, content) {
  const c = content.patient.exercises;
  const objects = c.objects;
  const token = ++activeToken;
  const timers = [];
  const startedAt = Date.now();
  const stages = ['intro'].concat(SEQUENCE, ['praise']);

  let stageIndex = 0;
  let completedRounds = 0;

  // How far through each exercise this session has got.
  const progress = { 'exercise-1': 0, 'exercise-2': 0, 'exercise-3': 0 };

  function alive() {
    return token === activeToken;
  }

  function later(fn, ms) {
    timers.push(setTimeout(() => {
      if (alive()) fn();
    }, ms));
  }

  function clearTimers() {
    while (timers.length) clearTimeout(timers.pop());
  }

  // Speaks, then runs fn once: as soon as the voice finishes, or at maxMs if
  // there is no voice engine. Whichever comes first, only once.
  function speakThen(text, fn, maxMs) {
    let done = false;
    const go = () => {
      if (done || !alive()) return;
      done = true;
      fn();
    };
    speak(text, () => later(go, AFTER_SPEECH_MS));
    later(go, maxMs);
  }

  // Called before any route change out of the session.
  function leave() {
    activeToken += 1;
    clearTimers();
    stopSpeaking();
  }

  function screen(children) {
    return el('div', { class: 'patient-screen exercise-screen' },
      [homeIcon(navigate, content, leave)].concat(children));
  }

  function objectView(id) {
    const object = objects[id];
    return { id: id, label: object.label, image: object.image };
  }

  function progressDots(total, doneCount) {
    return el('div', { class: 'progress-dots', 'aria-hidden': 'true' },
      Array.from({ length: total }, (_, i) =>
        el('span', { class: i < doneCount ? 'dot is-done' : 'dot' })));
  }

  function feedbackLine() {
    return el('p', { class: 'feedback', 'aria-live': 'polite' }, '');
  }

  // Clears the tone class too, not just the text — otherwise the line stays
  // coloured after a retry wipes it.
  function clearFeedback(element) {
    element.textContent = '';
    element.className = 'feedback';
  }

  /* ---------- session flow ---------- */

  function paint() {
    clearTimers();
    container.innerHTML = '';
    const stage = stages[stageIndex];
    if (stage === 'exercise-1') paintReminiscence();
    else if (stage === 'exercise-2') paintMatching();
    else if (stage === 'exercise-3') paintSpot();
    else if (stage === 'praise') paintPraise();
    else paintIntro();
  }

  function nextStage() {
    stageIndex += 1;
    paint();
  }

  // Records a resolved round, speaks the feedback, and moves on as soon as the
  // line has been heard (or at maxMs on a device with no voice).
  function resolveRound(exerciseId, total, outcome, line, tone, element, maxMs) {
    recordRound(exerciseId, outcome);
    completedRounds += 1;
    sayThen(line, element, tone, () => {
      progress[exerciseId] += 1;
      if (progress[exerciseId] >= total) nextStage();
      else paint();
    }, maxMs);
  }

  // Says a feedback line and reports when the voice is done, so callers can
  // move on as soon as it has been heard.
  function sayThen(line, element, tone, fn, maxMs) {
    element.textContent = line.text;
    element.className = 'feedback is-' + tone;
    let done = false;
    const go = () => {
      if (done || !alive()) return;
      done = true;
      fn();
    };
    speak(line.speech, () => later(go, AFTER_SPEECH_MS));
    later(go, maxMs);
  }

  /* ---------- intro ---------- */

  function paintIntro() {
    container.appendChild(screen([
      el('h1', {}, c.intro.title),
      el('p', { class: 'exercise-lead' }, c.intro.line),
    ]));
    speakThen(c.intro.speech, nextStage, INTRO_MS);
  }

  /* ---------- exercise 1: reminiscence recall ---------- */

  const reminiscence = c.reminiscence;

  // The pool is the content pack plus any photos the caregiver has added:
  // two or more named photos become "Which one is <name>?" rounds.
  function buildReminiscencePool() {
    const items = reminiscence.items.map((item) => ({
      id: item.id,
      scene: item.scene,
      question: item.question,
      questionSpeech: item.questionSpeech || item.question,
      answer: item.answer,
      distractors: item.distractors,
      catalogue: objects,
      imageOnly: false,
    }));

    const photos = getMemories().filter((memory) => memory.name && memory.image);
    if (photos.length >= 2) {
      const catalogue = {};
      for (const photo of photos) {
        catalogue[photo.id] = { label: photo.name, image: photo.image };
      }
      for (const photo of photos) {
        items.push({
          id: 'photo-' + photo.id,
          scene: null,
          question: reminiscence.photoQuestion.replace('{name}', photo.name),
          questionSpeech: (reminiscence.photoQuestionSpeech || reminiscence.photoQuestion)
            .replace('{name}', photo.name),
          answer: photo.id,
          distractors: photos.filter((other) => other.id !== photo.id)
            .map((other) => other.id),
          catalogue: catalogue,
          // Printing the names under the photos would give the answer away.
          imageOnly: true,
        });
      }
    }
    return shuffle(items).slice(0, reminiscence.roundsPerSession);
  }

  const reminiscenceItems = buildReminiscencePool();

  function buildReminiscenceOptions(item, count) {
    const catalogue = item.catalogue;
    const distractors = shuffle(item.distractors)
      .filter((id) => catalogue[id])
      .slice(0, Math.max(0, count - 1));
    return shuffle([item.answer].concat(distractors))
      .filter((id) => catalogue[id])
      .map((id) => ({ id: id, label: catalogue[id].label, image: catalogue[id].image }));
  }

  function paintReminiscence() {
    const total = reminiscenceItems.length;
    const item = reminiscenceItems[progress['exercise-1']];
    // Option count is the difficulty lever, re-read each round so a change
    // between rounds takes effect immediately.
    const options = buildReminiscenceOptions(
      item, byLevel(reminiscence.optionsByLevel, getDifficulty('exercise-1')));
    const feedback = feedbackLine();
    const buttons = [];
    let resolved = false;

    function choose(chosenId) {
      // One resolved answer per round: later taps do nothing at all.
      if (resolved) return;
      resolved = true;
      const correct = chosenId === item.answer;

      for (const button of buttons) {
        button.disabled = true;
        if (button.dataset.optionId === item.answer) button.classList.add('is-correct');
        else if (button.dataset.optionId === chosenId) button.classList.add('is-passed-over');
      }

      resolveRound('exercise-1', total,
        { correct: correct, promptId: item.id, attempts: 1 },
        correct ? pickOne(c.feedback.correct) : c.feedback.wrong,
        correct ? 'good' : 'gentle',
        feedback,
        correct ? CORRECT_MS : REVEAL_MS);
    }

    for (const option of options) {
      const button = el('button', {
        class: 'option-btn',
        'aria-label': option.label,
        onclick: () => choose(option.id),
      }, [
        el('img', { src: option.image, alt: '' }),
        item.imageOnly ? null : el('span', { class: 'option-label' }, option.label),
      ]);
      if (item.imageOnly) button.classList.add('is-image-only');
      button.dataset.optionId = option.id;
      buttons.push(button);
    }

    container.appendChild(screen([
      item.scene
        ? el('div', { class: 'exercise-scene' }, [el('img', { src: item.scene, alt: '' })])
        : null,
      el('p', { class: 'exercise-question' }, item.question),
      el('div', { class: 'options' }, buttons),
      feedback,
      progressDots(total, progress['exercise-1']),
    ]));

    speak(item.questionSpeech || item.question);
  }

  /* ---------- exercise 2: matching ---------- */

  const matching = c.matching;

  function paintMatching() {
    const total = matching.roundsPerSession;
    const pairCount = byLevel(matching.pairsByLevel, getDifficulty('exercise-2'));
    const chosen = shuffle(matching.pool).filter((id) => objects[id]).slice(0, pairCount);
    // Every picture appears exactly twice, face up. Finding one pair ends the round.
    const tileIds = shuffle(chosen.concat(chosen));
    const feedback = feedbackLine();
    const tiles = [];
    let firstPick = null;
    let busy = false;      // true while a mismatch is being shown
    let resolved = false;
    let attempts = 0;

    function clearSelection() {
      firstPick = null;
      for (const tile of tiles) tile.classList.remove('is-selected');
    }

    function pick(tile) {
      if (resolved || busy) return;

      if (firstPick === tile) {
        // Tapping the same tile again simply deselects it.
        clearSelection();
        return;
      }

      if (!firstPick) {
        firstPick = tile;
        tile.classList.add('is-selected');
        return;
      }

      attempts += 1;
      tile.classList.add('is-selected');

      if (tile.dataset.objectId === firstPick.dataset.objectId) {
        resolved = true;
        tile.classList.add('is-matched');
        firstPick.classList.add('is-matched');
        // Solved first time = a clean round for the adaptive engine.
        resolveRound('exercise-2', total,
          { correct: attempts === 1, promptId: tile.dataset.objectId, attempts: attempts },
          pickOne(c.feedback.correct), 'good', feedback, CORRECT_MS);
        return;
      }

      // No match: say so gently, reset the tiles, and let them try again.
      // The round never gives up on its own.
      busy = true;
      sayThen(c.feedback.retry, feedback, 'gentle', () => {
        clearSelection();
        clearFeedback(feedback);
        busy = false;
        speak(matching.promptSpeech || matching.prompt);
      }, RETRY_MS);
    }

    for (const id of tileIds) {
      const object = objects[id];
      const tile = el('button', {
        class: 'tile',
        'aria-label': object.label,
        onclick: () => pick(tile),
      }, [el('img', { src: object.image, alt: '' })]);
      tile.dataset.objectId = id;
      tiles.push(tile);
    }

    container.appendChild(screen([
      el('h2', { class: 'exercise-question' }, matching.prompt),
      el('div', { class: 'tiles', 'data-count': String(tiles.length) }, tiles),
      feedback,
      progressDots(total, progress['exercise-2']),
    ]));

    speak(matching.promptSpeech || matching.prompt);
  }

  /* ---------- exercise 3: spot the object ---------- */

  const spot = c.spot;

  function paintSpot() {
    const total = spot.roundsPerSession;
    const count = byLevel(spot.optionsByLevel, getDifficulty('exercise-3'));
    const options = shuffle(spot.pool).filter((id) => objects[id]).slice(0, count).map(objectView);
    const target = pickOne(options);
    const promptText = spot.prompt.replace('{object}', target.label);
    const promptSpeech = (spot.promptSpeech || spot.prompt).replace('{object}', target.label);
    const feedback = feedbackLine();
    const buttons = [];
    let resolved = false;
    let busy = false;
    let attempts = 0;

    function choose(chosenId) {
      if (resolved || busy) return;
      attempts += 1;

      if (chosenId === target.id) {
        resolved = true;
        for (const button of buttons) {
          button.disabled = true;
          if (button.dataset.optionId === target.id) button.classList.add('is-correct');
        }
        resolveRound('exercise-3', total,
          { correct: attempts === 1, promptId: target.id, attempts: attempts },
          pickOne(c.feedback.correct), 'good', feedback, CORRECT_MS);
        return;
      }

      // Wrong tap: no reveal, no skip — just a nudge and another go.
      busy = true;
      const missed = buttons.filter((b) => b.dataset.optionId === chosenId)[0];
      if (missed) missed.classList.add('is-passed-over');
      sayThen(c.feedback.retry, feedback, 'gentle', () => {
        if (missed) missed.classList.remove('is-passed-over');
        clearFeedback(feedback);
        busy = false;
        speak(promptSpeech);
      }, RETRY_MS);
    }

    for (const option of options) {
      const button = el('button', {
        class: 'option-btn is-image-only',
        'aria-label': option.label,
        onclick: () => choose(option.id),
      }, [el('img', { src: option.image, alt: '' })]);
      button.dataset.optionId = option.id;
      buttons.push(button);
    }

    container.appendChild(screen([
      el('h2', { class: 'exercise-question' }, promptText),
      el('div', { class: 'options' }, buttons),
      feedback,
      progressDots(total, progress['exercise-3']),
    ]));

    speak(promptSpeech);
  }

  /* ---------- praise ---------- */

  function paintPraise() {
    container.appendChild(screen([
      el('div', { class: 'praise-mark', 'aria-hidden': 'true' }, '★'),
      el('h1', {}, c.praise.title),
      el('p', { class: 'exercise-lead' }, c.praise.line),
    ]));
    recordSession({ completed: completedRounds, startedAt: startedAt });
    speakThen(c.praise.speech, () => {
      leave();
      navigate('patient-home');
    }, PRAISE_MS);
  }

  touchActivity();
  paint();
}
