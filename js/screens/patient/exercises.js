// The exercises session: linear, voice-led, self-advancing. There is no Next
// button and no back navigation — the only way out is the Home icon. A round
// only advances once it has been resolved, so repeated taps can never skip it.

import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';
import { speak, stopSpeaking, estimateDuration } from '../../core/voice.js';
import { listenSupported, listenOnce, stopListening, matchSpoken } from '../../core/listen.js';
import {
  getMemories,
  getDifficulty,
  getSettings,
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
const LEVEL_UP_MS = 3000; // the adaptive engine moved up: say so before the next round
const AFTER_SPEECH_MS = 700; // a beat to let the screen settle
// The gap between silencing the voice and opening the microphone. Short enough
// to feel instant on a deliberate tap, long enough that the recogniser does not
// take the tail of the app's own question as the patient's answer.
const MIC_OPEN_MS = 180;

const SEQUENCE = ['exercise-1', 'exercise-2', 'exercise-3', 'exercise-4', 'exercise-5'];

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
  const progress = {
    'exercise-1': 0, 'exercise-2': 0, 'exercise-3': 0, 'exercise-4': 0, 'exercise-5': 0,
  };

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
    later(go, ceiling(text, maxMs));
  }

  // Called before any route change out of the session.
  function leave() {
    activeToken += 1;
    clearTimers();
    stopSpeaking();
    // The microphone must never outlive the screen that opened it.
    stopListening();
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
    // Nothing from the screen being replaced may still be audible or listening
    // once the next one is up. Leaving this to the incoming screen's own
    // speak() meant any stage that does not speak immediately — or at all —
    // let the previous line run on underneath it.
    stopSpeaking();
    stopListening();
    container.innerHTML = '';
    const stage = stages[stageIndex];
    if (stage === 'exercise-1') paintReminiscence();
    else if (stage === 'exercise-2') paintMatching();
    else if (stage === 'exercise-3') paintSpot();
    else if (stage === 'exercise-4') paintRoutine();
    else if (stage === 'exercise-5') paintPattern();
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
    const record = recordRound(exerciseId, outcome);
    completedRounds += 1;

    const advance = () => {
      progress[exerciseId] += 1;
      if (progress[exerciseId] >= total) nextStage();
      else paint();
    };

    sayThen(line, element, tone, () => {
      // The rules engine just moved this exercise up a level. Say so warmly, so
      // the harder round the patient is about to meet is never a silent
      // surprise. Easing DOWN is deliberately never announced — naming it would
      // turn an invisible adjustment into a fail state.
      if (record.lastChange === 'up') {
        sayThen(c.feedback.levelUp, element, 'levelup', advance, LEVEL_UP_MS);
      } else {
        advance();
      }
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
    // maxMs is the safety net for a device whose speech never reports back. A
    // pre-recorded line has a known length, so the net has to clear it —
    // otherwise the screen would advance over the end of its own sentence.
    later(go, ceiling(line.speech, maxMs));
  }

  // A tap-to-talk microphone. It opens only on a deliberate press, closes as
  // soon as it has an answer, and is absent entirely where speech cannot work
  // — a button that can never succeed is worse than no button.
  //
  // A transcript that matches nothing is not a wrong answer and is never
  // recorded as one: the patient is told plainly that it was not heard, and
  // the round waits for them exactly as before.
  function speechInput(options, onMatch, isResolved, feedback) {
    if (!listenSupported() || !getSettings().speechInput) return null;

    const strings = c.speech;
    const label = el('span', { class: 'mic-label' }, strings.start);
    const button = el('button', {
      class: 'mic-btn',
      type: 'button',
      'aria-label': strings.start,
    }, [
      el('span', { class: 'mic-icon', 'aria-hidden': 'true' }, '🎤'),
      label,
    ]);
    let listening = false;
    let stoppedByPatient = false;

    const reset = () => {
      listening = false;
      button.classList.remove('is-listening');
      label.textContent = strings.start;
      button.setAttribute('aria-label', strings.start);
    };

    button.addEventListener('click', () => {
      if (isResolved()) return;
      if (listening) {
        // Switching the microphone off is a choice, not a failed attempt.
        stoppedByPatient = true;
        stopListening();
        reset();
        return;
      }
      listening = true;
      stoppedByPatient = false;
      button.classList.add('is-listening');
      label.textContent = strings.listening;
      button.setAttribute('aria-label', strings.stop);
      // The question is still being spoken on some devices; talking over the
      // patient while asking them to talk is not a conversation.
      stopSpeaking();

      let matched = false;
      // Opened on a timer rather than in this tick: stopSpeaking() has just
      // silenced the question, and the microphone should not be live while the
      // speaker is still settling.
      later(() => {
        if (!listening || isResolved()) return;
        listenOnce({
          lang: content.app.speechLang && content.app.speechLang[0],
          onResult: (heard) => {
            if (isResolved()) return;
            const id = matchSpoken(heard, options);
            if (id) {
              matched = true;
              onMatch(id);
            }
          },
          onDone: () => {
            if (!alive()) return;
            reset();
            if (matched || isResolved() || stoppedByPatient) return;
            // Speech has just failed in a way that will not recover — no
            // network for the recogniser, or permission refused. Take the
            // button away: leaving it is the dead control this module exists
            // to avoid, and a patient who taps it again gets nothing twice.
            if (!listenSupported()) {
              if (button.parentNode) button.parentNode.removeChild(button);
            }
            // Then say something, retired or not. The patient has just spoken
            // out loud and is waiting; silence reads as being ignored, which is
            // worse than being told plainly that it was not heard. The line
            // blames nobody and the round is untouched — tapping still works.
            const line = c.feedback.notHeard;
            feedback.textContent = line.text;
            feedback.className = 'feedback is-gentle';
            speak(line.speech);
          },
        });
      }, MIC_OPEN_MS);
    });

    return el('div', { class: 'mic-row' }, [
      button,
      el('span', { class: 'mic-hint' }, strings.prompt),
    ]);
  }

  // The safety net for a device whose speech never reports back. It must never
  // fire while the line is still being said: advancing mid-sentence is what
  // starts the next screen talking over the tail of this one. A recorded line
  // has a measured length; a line assembled at runtime from a name or an object
  // has none, and used to fall back to a flat constant that was routinely too
  // short for it — so estimate that case rather than guessing low.
  function ceiling(speech, maxMs) {
    return Math.max(maxMs, estimateDuration(speech) + AFTER_SPEECH_MS + 400);
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
      stopListening();
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

    // Speech input, where the device and the caregiver both allow it. It feeds
    // choose() — the same path a tap takes — so the learner, the rules engine
    // and the wrong-answer handling cannot tell the two apart. Nothing here is
    // on the advance path: if it never fires, the round still works by tapping.
    const mic = speechInput(options, (id) => choose(id), () => resolved, feedback);

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
      mic,
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

  /* ---------- exercise 4: daily routine recall ---------- */

  const routine = c.routine;
  const routineItems = shuffle(routine.items);

  function paintRoutine() {
    const total = routine.roundsPerSession;
    const item = routineItems[progress['exercise-4'] % routineItems.length];
    const stepCount = byLevel(routine.stepsByLevel, getDifficulty('exercise-4'));
    // Steps are authored in order, so the first N of them are a valid routine.
    const ordered = item.steps.slice(0, stepCount);
    const feedback = feedbackLine();
    const prompt = el('p', { class: 'exercise-question' }, routine.promptFirst);
    const cards = [];
    let placed = 0;
    let busy = false;
    let attempts = 0;

    function choose(card) {
      if (busy || placed >= ordered.length) return;
      const expected = ordered[placed];

      if (card.dataset.stepId !== expected.id) {
        // Out of order: say so kindly and leave everything where it is.
        attempts += 1;
        busy = true;
        card.classList.add('is-passed-over');
        sayThen({ text: routine.wrongText, speech: routine.wrongSpeech },
          feedback, 'gentle', () => {
            card.classList.remove('is-passed-over');
            clearFeedback(feedback);
            busy = false;
          }, RETRY_MS);
        return;
      }

      placed += 1;
      card.disabled = true;
      card.classList.add('is-placed');
      const badge = card.querySelector('.step-badge');
      if (badge) badge.textContent = String(placed);

      if (placed >= ordered.length) {
        resolveRound('exercise-4', total,
          { correct: attempts === 0, promptId: item.id, attempts: attempts + 1 },
          pickOne(c.feedback.correct), 'good', feedback, CORRECT_MS);
        return;
      }

      prompt.textContent = routine.promptNext;
      speak(routine.promptNextSpeech);
    }

    for (const stepItem of shuffle(ordered)) {
      const card = el('button', {
        class: 'step-card',
        'aria-label': stepItem.label,
        onclick: () => choose(card),
      }, [
        el('span', { class: 'step-badge', 'aria-hidden': 'true' }, ''),
        el('img', { src: stepItem.image, alt: '' }),
        el('span', { class: 'step-label' }, stepItem.label),
      ]);
      card.dataset.stepId = stepItem.id;
      cards.push(card);
    }

    container.appendChild(screen([
      el('h2', { class: 'exercise-lead' },
        routine.question.replace('{name}', item.name)),
      prompt,
      el('div', { class: 'steps' }, cards),
      feedback,
      progressDots(total, progress['exercise-4']),
    ]));

    speak(routine.questionSpeech.replace('{name}', item.name) + ' ' +
      routine.promptFirstSpeech);
  }

  /* ---------- exercise 5: pattern recognition ---------- */

  const pattern = c.pattern;

  function paintPattern() {
    const total = pattern.roundsPerSession;
    const level = getDifficulty('exercise-5');
    const template = pattern.templatesByLevel[
      Math.min(pattern.templatesByLevel.length, Math.max(1, level)) - 1];
    const optionCount = byLevel(pattern.optionsByLevel, level);

    // Map the template's slots (A, B, C) onto real pictures.
    const slots = [];
    for (const slot of template) if (slots.indexOf(slot) === -1) slots.push(slot);
    const picked = shuffle(pattern.pool).filter((id) => objects[id]).slice(0, slots.length);
    if (picked.length < slots.length) { nextStage(); return; }
    const bySlot = {};
    slots.forEach((slot, index) => { bySlot[slot] = picked[index]; });

    const shown = template.slice(0, template.length - 1).map((slot) => bySlot[slot]);
    const answerId = bySlot[template[template.length - 1]];

    // Options: the answer plus other pictures, never a duplicate.
    const spare = shuffle(pattern.pool)
      .filter((id) => objects[id] && id !== answerId && picked.indexOf(id) === -1);
    const wrong = picked.filter((id) => id !== answerId).concat(spare);
    const options = shuffle([answerId].concat(wrong.slice(0, Math.max(0, optionCount - 1))))
      .map(objectView);

    const feedback = feedbackLine();
    const buttons = [];
    let resolved = false;
    let busy = false;
    let attempts = 0;

    function choose(chosenId) {
      if (resolved || busy) return;
      attempts += 1;

      if (chosenId === answerId) {
        resolved = true;
        const slot = container.querySelector('.pattern-blank');
        if (slot) {
          slot.classList.add('is-filled');
          slot.innerHTML = '';
          slot.appendChild(el('img', { src: objects[answerId].image, alt: '' }));
        }
        for (const button of buttons) {
          button.disabled = true;
          if (button.dataset.optionId === answerId) button.classList.add('is-correct');
        }
        resolveRound('exercise-5', total,
          { correct: attempts === 1, promptId: template.join(''), attempts: attempts },
          pickOne(c.feedback.correct), 'good', feedback, CORRECT_MS);
        return;
      }

      busy = true;
      const missed = buttons.filter((b) => b.dataset.optionId === chosenId)[0];
      if (missed) missed.classList.add('is-passed-over');
      sayThen(c.feedback.retry, feedback, 'gentle', () => {
        if (missed) missed.classList.remove('is-passed-over');
        clearFeedback(feedback);
        busy = false;
        speak(pattern.promptSpeech);
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

    const row = el('div', { class: 'pattern-row' },
      shown.map((id) => el('span', { class: 'pattern-item' },
        [el('img', { src: objects[id].image, alt: '' })]))
      .concat([el('span', { class: 'pattern-blank' }, '?')]));

    container.appendChild(screen([
      el('h2', { class: 'exercise-question' }, pattern.prompt),
      row,
      el('div', { class: 'options' }, buttons),
      feedback,
      progressDots(total, progress['exercise-5']),
    ]));

    speak(pattern.promptSpeech);
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
