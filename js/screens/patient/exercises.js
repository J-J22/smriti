// The exercises session: linear, voice-led, self-advancing. There is no Next
// button and no back navigation — the only way out is the Home icon. A round
// only advances once it has been answered, so repeated taps can never skip it.

import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';
import { speak, stopSpeaking } from '../../core/voice.js';
import {
  getDifficulty,
  recordRound,
  recordSession,
  touchActivity,
} from '../../core/store.js';

const INTRO_MS = 4600;
const CORRECT_MS = 2200;
const REVEAL_MS = 3600; // longer: the correct answer is being shown
const PRAISE_MS = 4200;

// Exercises 2 and 3 join this list as they are built.
const SEQUENCE = ['exercise-1'];

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

export function renderExercises(container, params, navigate, content) {
  const c = content.patient.exercises;
  const token = ++activeToken;
  const timers = [];
  const startedAt = Date.now();
  const stages = ['intro'].concat(SEQUENCE, ['praise']);

  let stageIndex = 0;
  let completedRounds = 0;

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

  function paint() {
    clearTimers();
    container.innerHTML = '';
    const stage = stages[stageIndex];
    if (stage === 'exercise-1') paintReminiscence();
    else if (stage === 'praise') paintPraise();
    else paintIntro();
  }

  function nextStage() {
    stageIndex += 1;
    paint();
  }

  /* ---------- intro ---------- */

  function paintIntro() {
    container.appendChild(screen([
      el('h1', {}, c.intro.title),
      el('p', { class: 'exercise-lead' }, c.intro.line),
    ]));
    speak(c.intro.speech);
    later(nextStage, INTRO_MS);
  }

  /* ---------- exercise 1: reminiscence recall ---------- */

  const reminiscence = c.reminiscence;
  const roundItems = shuffle(reminiscence.items).slice(0, reminiscence.roundsPerSession);
  let roundIndex = 0;

  // Option count is the difficulty lever: 2 pictures at the easiest level,
  // more as the rules engine steps up. Read fresh each round so a change
  // between rounds takes effect immediately.
  function optionCountForLevel(level) {
    const byLevel = reminiscence.optionsByLevel || [2];
    return byLevel[Math.min(byLevel.length, Math.max(1, level)) - 1] || byLevel[0];
  }

  function buildOptions(item, count) {
    const objects = c.objects;
    const distractors = shuffle(item.distractors)
      .filter((id) => objects[id])
      .slice(0, Math.max(0, count - 1));
    return shuffle([item.answer].concat(distractors))
      .filter((id) => objects[id])
      .map((id) => ({ id: id, label: objects[id].label, image: objects[id].image }));
  }

  function progressDots(total, doneCount) {
    return el('div', { class: 'progress-dots', 'aria-hidden': 'true' },
      Array.from({ length: total }, (_, i) =>
        el('span', { class: i < doneCount ? 'dot is-done' : 'dot' })));
  }

  function paintReminiscence() {
    const item = roundItems[roundIndex];
    const level = getDifficulty('exercise-1');
    const options = buildOptions(item, optionCountForLevel(level));
    const feedback = el('p', { class: 'feedback', 'aria-live': 'polite' }, '');
    const buttons = [];
    let resolved = false;

    function choose(chosenId) {
      // One resolved answer per round: later taps do nothing at all.
      if (!resolved) resolve(chosenId);
    }

    function resolve(chosenId) {
      resolved = true;
      const correct = chosenId === item.answer;

      for (const button of buttons) {
        button.disabled = true;
        if (button.dataset.optionId === item.answer) button.classList.add('is-correct');
        else if (button.dataset.optionId === chosenId) button.classList.add('is-passed-over');
      }

      const line = correct ? pickOne(c.feedback.correct) : c.feedback.wrong;
      feedback.textContent = line.text;
      feedback.classList.add(correct ? 'is-good' : 'is-gentle');
      speak(line.speech);

      recordRound('exercise-1', { correct: correct, promptId: item.id });
      completedRounds += 1;

      later(advanceRound, correct ? CORRECT_MS : REVEAL_MS);
    }

    function advanceRound() {
      roundIndex += 1;
      if (roundIndex >= roundItems.length) nextStage();
      else paint();
    }

    for (const option of options) {
      const button = el('button', {
        class: 'option-btn',
        'aria-label': option.label,
        onclick: () => choose(option.id),
      }, [
        el('img', { src: option.image, alt: '' }),
        el('span', { class: 'option-label' }, option.label),
      ]);
      button.dataset.optionId = option.id;
      buttons.push(button);
    }

    container.appendChild(screen([
      el('div', { class: 'exercise-scene' }, [
        el('img', { src: item.scene, alt: '' }),
      ]),
      el('p', { class: 'exercise-question' }, item.question),
      el('div', { class: 'options' }, buttons),
      feedback,
      progressDots(roundItems.length, roundIndex),
    ]));

    speak(item.questionSpeech || item.question);
  }

  /* ---------- praise ---------- */

  function paintPraise() {
    container.appendChild(screen([
      el('div', { class: 'praise-mark', 'aria-hidden': 'true' }, '★'),
      el('h1', {}, c.praise.title),
      el('p', { class: 'exercise-lead' }, c.praise.line),
    ]));
    speak(c.praise.speech);
    recordSession({ completed: completedRounds, startedAt: startedAt });
    later(() => {
      leave();
      navigate('patient-home');
    }, PRAISE_MS);
  }

  touchActivity();
  paint();
}
