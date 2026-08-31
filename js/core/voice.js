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

// Resolved against this module's own URL so pages in subdirectories work too.
const AUDIO_BASE = new URL('../../assets/audio/', import.meta.url);

let clips = null;      // exact line -> { f: file name, ms: duration }
let clipDir = null;
let playing = null;    // the audio element in flight, if any

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

export function speak(text, onEnd) {
  if (!text) return;
  stopSpeaking();
  const gen = generation;
  const line = String(text).trim();
  const entry = clips ? clips[line] : null;
  const file = entry ? entry.f : null;

  // Chrome drops an utterance queued in the same tick as cancel(), so hand it
  // over on the next one. Recordings go through the same beat, which keeps the
  // pacing identical whichever source ends up speaking.
  pending = setTimeout(() => {
    pending = null;
    if (gen !== generation) return;
    if (file && playClip(file, line, onEnd, gen)) return;
    speakLive(line, onEnd, gen);
  }, 60);
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
    if (playing === audio) playing = null;
    if (gen !== generation) return;
    speakLive(line, onEnd, gen);
  };

  audio.addEventListener('ended', settle);
  audio.addEventListener('error', giveUp);
  playing = audio;

  try {
    const started = audio.play();
    // Autoplay can be refused before the first tap of a session.
    if (started && typeof started.catch === 'function') started.catch(giveUp);
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
}

export function stopSpeaking() {
  // Retire every callback still outstanding before anything is torn down, so
  // the abort this causes cannot be mistaken for a line ending or failing.
  generation += 1;
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  if (playing) {
    try {
      playing.pause();
      playing.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
    playing = null;
  }
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
