// Optional speech input. The patient may SAY an answer instead of tapping it.
//
// Three rules this module exists to enforce, from CLAUDE.md:
//   1. Never required. Tapping always works, unchanged. Nothing in the app
//      waits on speech, and no screen can be advanced only by voice.
//   2. Exercises only. It is never a way to navigate.
//   3. Never a fail state. A transcript that matches nothing does nothing —
//      the patient simply taps, and is told nothing went wrong, because
//      nothing did.
//
// Honest note on offline: the browser's recogniser is cloud-backed on Android
// Chrome — it streams audio to a server. There is no offline speech
// recognition available to a web page. So this is an enhancement where there
// is signal, and the app is fully usable without it; a network error quietly
// retires the microphone for the session rather than leaving a dead button on
// the screen.
//
// The microphone only ever opens on a deliberate tap. It never listens on its
// own, and it stops the moment a round resolves.

const Recognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

let active = null;
let retired = false;   // a network failure means it cannot work on this device

export function listenSupported() {
  return Boolean(Recognition) && !retired;
}

// True once speech has failed in a way that will not recover this session.
export function listenRetired() {
  return retired;
}

// Opens the microphone for one answer. Returns a stop function. onResult gets
// the raw transcript; onDone fires exactly once, whatever the outcome, with a
// reason the caller can show or ignore.
export function listenOnce({ lang, onResult, onDone }) {
  if (!listenSupported()) {
    if (onDone) onDone('unsupported');
    return () => {};
  }

  stopListening();

  let finished = false;
  const finish = (reason) => {
    if (finished) return;
    finished = true;
    if (active === recognition) active = null;
    if (onDone) onDone(reason);
  };

  let recognition;
  try {
    recognition = new Recognition();
  } catch (err) {
    if (onDone) onDone('unsupported');
    return () => {};
  }

  recognition.lang = lang || 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 3;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const heard = [];
    for (const result of event.results) {
      for (let i = 0; i < result.length; i++) heard.push(result[i].transcript);
    }
    if (onResult) onResult(heard);
  };

  recognition.onerror = (event) => {
    const error = event && event.error;
    // 'network' means the recogniser could not reach its service — offline, or
    // a device without it. Retire the microphone rather than offering the
    // patient a button that cannot work.
    if (error === 'network' || error === 'service-not-allowed') retired = true;
    if (error === 'not-allowed') retired = true;   // permission refused
    finish(error || 'error');
  };

  recognition.onend = () => finish('end');

  try {
    recognition.start();
    active = recognition;
  } catch (err) {
    finish('error');
    return () => {};
  }

  return () => stopListening();
}

export function stopListening() {
  if (!active) return;
  const recognition = active;
  active = null;
  try {
    recognition.abort();
  } catch (err) {
    /* ignore */
  }
}

/* ---------------------------------------------------------------
   Matching a spoken answer to an option on screen.

   Deliberately conservative. Resolving the WRONG option because a
   transcript was garbled would invent a mistake the patient never made,
   and a false wrong answer is far worse here than hearing nothing at
   all: it trains the learner on a lie and it tells someone with memory
   loss they were wrong when they were not. So a match must be both
   strong and unambiguous, or nothing happens.
   --------------------------------------------------------------- */

export const MIN_SCORE = 0.7;   // how close the best option must be
export const MIN_MARGIN = 0.12; // how far ahead of the runner-up

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = [];
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 0;
  return 1 - editDistance(a, b) / longest;
}

// How well one transcript matches one label, 0..1.
function score(transcript, label) {
  const said = normalise(transcript);
  const want = normalise(label);
  if (!said || !want) return 0;
  if (said === want) return 1;

  // People answer in sentences: "I think that's the gamosa". A label found
  // whole inside the transcript is a confident match.
  const words = said.split(' ');
  const wanted = want.split(' ');
  if (wanted.every((word) => words.indexOf(word) !== -1)) return 0.95;

  // Otherwise take the best any single spoken word manages against the label,
  // alongside the whole-string similarity, so one clear word still counts.
  let best = similarity(said, want);
  for (const word of words) {
    if (word.length < 3) continue;
    best = Math.max(best, similarity(word, want));
  }
  return best;
}

// Picks the option a transcript refers to, or null when it is not clear.
// `options` is [{ id, label }]; `heard` is the list of alternatives returned
// by the recogniser.
export function matchSpoken(heard, options) {
  const transcripts = [].concat(heard || []).filter(Boolean);
  if (!transcripts.length || !options || !options.length) return null;

  const scored = options.map((option) => {
    let best = 0;
    for (const transcript of transcripts) {
      best = Math.max(best, score(transcript, option.label));
    }
    return { id: option.id, score: best };
  }).sort((a, b) => b.score - a.score);

  const winner = scored[0];
  const runnerUp = scored[1];
  if (!winner || winner.score < MIN_SCORE) return null;
  if (runnerUp && winner.score - runnerUp.score < MIN_MARGIN) return null;
  return winner.id;
}
