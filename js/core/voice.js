// TTS leads every patient screen. Speech is a one-way aid: nothing in the app
// ever waits on it, so a device with no voice engine still works normally —
// callers always pair onEnd with their own fallback timer.
//
// Two sources, in order. Every fixed patient-facing line is pre-rendered once
// by tools/build-voice.py with a neural voice and shipped as an audio file, so
// the app plays a recording rather than synthesising: it sounds human, and it
// sounds the same on every device instead of depending on whatever engine the
// phone happens to carry. Lines assembled at runtime from a name or a time
// have no file, and fall through to speechSynthesis below.

const RATE = 0.9; // a little slower than default, easier to follow

// How long a line takes when the live engine says it. Lines assembled at
// runtime from a name, a time or an object have no recording, so there is no
// measured length to use — and a screen that guesses too low advances over the
// end of its own sentence, which is what puts two voices on top of each other.
// Measured against the shipped clips: the neural voice at RATE averages a shade
// over 400ms a word, and device engines are slower rather than faster.
const MS_PER_WORD = 430;
const MIN_SPOKEN_MS = 1100;

// speechSynthesis.cancel() is asynchronous on Android Chrome — it returns at
// once and the engine keeps talking for a moment. Starting the next utterance
// into that gap is an overlap the app cannot hear and cannot undo, so wait for
// the engine to actually fall silent. Bounded: an engine that reports itself
// busy forever must not mute the app.
const CANCEL_POLL_MS = 40;
const CANCEL_WAIT_MAX_MS = 600;

// Resolved against this module's own URL so pages in subdirectories work too.
const AUDIO_BASE = new URL('../../assets/audio/', import.meta.url);

let clips = null;      // exact line -> { f: file name, ms: duration }
let clipDir = null;
let playing = null;    // the audio element in flight, if any

// Every clip element that might still be making a sound. `playing` alone was
// not enough: pause() on an element whose play() promise has not resolved is a
// documented Chromium race and does not always take effect, and the moment we
// dropped the reference nothing could stop that element again — it played on
// over every line that followed, which is the overlap that survived two fixes.
// Nothing leaves this set until it has been proved silent.
const live = new Set();

// A ring buffer of what the voice actually did, for diagnosing overlap on a
// phone with no developer tools. Off the hot path and capped; nothing reads it
// unless the app is opened with ?voicelog=1.
const LOG_LIMIT = 240;
const log = [];
function note(event, detail) {
  log.push({ t: Math.round(performance.now()), event: event, detail: detail || '' });
  if (log.length > LOG_LIMIT) log.shift();
}
export function voiceLog() {
  return log.slice();
}
// How many clips could be making a sound right now. Anything above 1 is the bug.
export function audibleCount() {
  let n = 0;
  for (const audio of live) if (!audio.paused && !audio.ended && !audio.muted) n += 1;
  return n;
}

// Bumped by every speak() and every stopSpeaking(). A line captures the value
// current when it starts and checks it before acting on any callback that
// arrives later. This is what keeps a cancelled line quiet.
//
// Both engines report a line we deliberately stopped as if something happened
// to it: pausing an <audio> whose play() has not resolved yet rejects that
// promise with AbortError, and speechSynthesis.cancel() fires onend on the
// utterance it just killed. Without this counter the first is indistinguishable
// from a broken file — so the line falls back to the live engine and says
// itself again over the top of whatever started next — and the second tells
// the caller a line finished when it never did.
let generation = 0;

// Ordered preference list from the active content pack. Assamese ships a
// fallback chain ending in Bengali: Android rarely carries an Assamese voice,
// and Assamese is written in the Bengali-Assamese script, so a Bengali voice
// pronounces it far closer than any Latin-script voice could.
let preferred = ['en-IN', 'en'];
let matched = null;
let resolved = false;
let pending = null;

function supported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Loads the pre-rendered index for a language. Missing audio is not an error:
// the app simply speaks live instead, exactly as it did before.
export async function loadVoiceClips(language) {
  clips = null;
  clipDir = null;
  try {
    const dir = new URL((language || 'en') + '/', AUDIO_BASE);
    const res = await fetch(new URL('index.json', dir).href);
    if (!res.ok) return 0;
    const index = await res.json();
    if (!index || typeof index !== 'object') return 0;
    clips = index;
    clipDir = dir;
    return Object.keys(index).length;
  } catch (err) {
    return 0;
  }
}

export function setVoiceLanguage(languageTags) {
  if (languageTags && languageTags.length) preferred = languageTags.slice();
  matched = null;
  resolved = false;
}

function normalise(tag) {
  return String(tag || '').toLowerCase().replace('_', '-');
}

function pickVoice() {
  if (resolved) return matched;
  if (!supported()) return null;
  let voices = [];
  try {
    voices = window.speechSynthesis.getVoices() || [];
  } catch (err) {
    voices = [];
  }
  // Voices load asynchronously on Chrome; stay unresolved until they arrive.
  if (!voices.length) return null;
  for (const want of preferred) {
    const target = normalise(want);
    const hit = voices.filter((voice) => normalise(voice.lang).indexOf(target) === 0)[0];
    if (hit) { matched = hit; resolved = true; return matched; }
  }
  resolved = true;
  matched = null;
  return null;
}

// What the caregiver screen reports: which voice this device actually found,
// and whether it is the language asked for or a fallback.
export function voiceStatus() {
  const recorded = clips ? Object.keys(clips).length : 0;
  const voice = pickVoice();
  const live = supported() && voice
    ? { available: true, exact: normalise(voice.lang).indexOf(normalise(preferred[0])) === 0,
        lang: voice.lang, name: voice.name }
    : { available: false, exact: false, lang: null, name: null };
  // Recorded lines carry the patient screens, so the device counts as having a
  // voice even where no engine is installed — the live one only fills the gaps.
  return {
    available: live.available || recorded > 0,
    exact: live.exact,
    lang: live.lang,
    name: live.name,
    recorded: recorded,
  };
}

// How long the recording for a line runs, in milliseconds, or 0 if there is
// none. Screens use this to widen their advance timer so a recording is never
// cut off mid-sentence.
export function clipDuration(text) {
  const entry = clips ? clips[String(text || '').trim()] : null;
  return entry && entry.ms ? entry.ms : 0;
}

// How long this line will take to say, in milliseconds — the measured length of
// its recording, or an estimate for a line that has none. Screens size their
// advance timers off this, so the safety net can never fire before the voice
// could plausibly have finished.
export function estimateDuration(text) {
  const line = String(text || '').trim();
  if (!line) return 0;
  const recorded = clipDuration(line);
  if (recorded) return recorded;
  const words = line.split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_SPOKEN_MS, words * MS_PER_WORD);
}

export function speak(text, onEnd) {
  if (!text) return;
  stopSpeaking();
  const gen = generation;
  const line = String(text).trim();
  const entry = clips ? clips[line] : null;
  const file = entry ? entry.f : null;
  note('speak', (file ? 'clip ' : 'live ') + line.slice(0, 40));

  // Chrome drops an utterance queued in the same tick as cancel(), so hand it
  // over on the next one. Recordings go through the same beat, which keeps the
  // pacing identical whichever source ends up speaking.
  //
  // Then wait for the engine to actually fall silent. stopSpeaking() has just
  // called cancel(), but cancel() is asynchronous on Android Chrome: it returns
  // at once while the engine keeps talking. Both sources have to respect that,
  // not just the live one — a recorded clip started over a live line that is
  // still finishing is the same two voices at once. Pausing an <audio> element
  // is synchronous, so this only ever waits on speechSynthesis.
  let waited = 0;
  const dispatch = () => {
    pending = null;
    if (gen !== generation) return;
    if (stillSpeaking() && waited < CANCEL_WAIT_MAX_MS) {
      waited += CANCEL_POLL_MS;
      pending = setTimeout(dispatch, CANCEL_POLL_MS);
      return;
    }
    if (file && playClip(file, line, onEnd, gen)) return;
    speakLive(line, onEnd, gen);
  };
  pending = setTimeout(dispatch, 60);
}

// Is the device engine still producing sound? Bounded use only: an engine that
// reports itself busy forever must never mute the app.
function stillSpeaking() {
  if (!supported()) return false;
  try {
    return Boolean(window.speechSynthesis.speaking || window.speechSynthesis.pending);
  } catch (err) {
    return false;
  }
}

// Plays a pre-rendered line. Returns false if the element could not even be
// created; a playback failure later falls back to the live engine instead.
function playClip(file, line, onEnd, gen) {
  let audio;
  try {
    audio = new Audio(new URL(file, clipDir).href);
  } catch (err) {
    return false;
  }

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    note('clip-end', 'audible now: ' + audibleCount());
    live.delete(audio);
    if (playing === audio) playing = null;
    // Stopped or replaced rather than finished: the caller must not be told
    // this line played to the end, or it will advance on a sentence the
    // patient never heard.
    if (gen !== generation) return;
    if (onEnd) onEnd();
  };
  // A file that will not play is not worth stalling on: hand the line to the
  // live engine rather than leaving the screen silent. But the pause() in
  // stopSpeaking() also lands here, as an aborted play() promise — that is a
  // cancelled line, not a broken file, and re-speaking it would talk over
  // whatever replaced it.
  const giveUp = () => {
    if (settled) return;
    settled = true;
    live.delete(audio);
    if (playing === audio) playing = null;
    if (gen !== generation) return;
    speakLive(line, onEnd, gen);
  };

  audio.addEventListener('ended', settle);
  audio.addEventListener('error', giveUp);
  playing = audio;
  live.add(audio);

  try {
    const started = audio.play();
    // Autoplay can be refused before the first tap of a session.
    if (started && typeof started.then === 'function') {
      started.then(() => {
        // play() has only now taken effect. If this line was stopped while that
        // was in flight, the pause() it was sent arrived too early to count and
        // this element is about to be heard over whatever replaced it.
        if (gen !== generation) {
          note('LATE-PLAY', 'play() resolved after this line was stopped');
          hardStop(audio);
        }
      }, giveUp);
    }
  } catch (err) {
    giveUp();
  }
  return true;
}

function speakLive(text, onEnd, gen) {
  const current = () => gen === generation;
  if (!supported()) {
    if (onEnd && current()) onEnd();
    return;
  }

  const utter = () => {
    if (!current()) return;
    try {
      const utterance = new SpeechSynthesisUtterance(String(text));
      utterance.rate = RATE;
      utterance.lang = preferred[0];
      const voice = pickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      if (onEnd) {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          // cancel() fires onend on the utterance it kills. That is this line
          // being stopped, not this line finishing.
          if (!current()) return;
          onEnd();
        };
        utterance.onend = settle;
        utterance.onerror = settle;
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      /* speech is optional — never block the screen on it */
      if (onEnd && current()) onEnd();
    }
  };

  utter();
}

// Silences one clip for certain. pause() is a request the element may still be
// too busy starting to honour; muted is a property, applied the instant it is
// set, whatever the element is doing. Set it first, so that even if playback
// wins the race it wins it silently.
function hardStop(audio) {
  if (!audio) return;
  if (!audio.paused && !audio.ended) note('hard-stop', 'was still audible');
  try {
    audio.muted = true;
    audio.pause();
    audio.currentTime = 0;
  } catch (err) {
    /* ignore — muted has already done the work that matters */
  }
  live.delete(audio);
}

export function stopSpeaking() {
  note('stop', 'audible: ' + audibleCount());
  // Retire every callback still outstanding before anything is torn down, so
  // the abort this causes cannot be mistaken for a line ending or failing.
  generation += 1;
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  // Every element, not just the current one. A clip that lost the play/pause
  // race is still in here, and this is the only thing that can reach it.
  for (const audio of Array.from(live)) hardStop(audio);
  playing = null;
  if (!supported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch (err) {
    /* ignore */
  }
}

// Voices arrive late on Chrome; re-resolve once they do.
if (supported() && typeof window.speechSynthesis.addEventListener === 'function') {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    matched = null;
    resolved = false;
  });
}
