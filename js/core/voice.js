// TTS leads every patient screen. Speech is a one-way aid: nothing in the app
// ever waits on it, so a device with no voice engine still works normally —
// callers always pair onEnd with their own fallback timer.

const RATE = 0.9; // a little slower than default, easier to follow

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
  const voice = pickVoice();
  if (!supported()) return { available: false, exact: false, lang: null, name: null };
  if (!voice) return { available: false, exact: false, lang: null, name: null };
  const exact = normalise(voice.lang).indexOf(normalise(preferred[0])) === 0;
  return { available: true, exact: exact, lang: voice.lang, name: voice.name };
}

export function speak(text, onEnd) {
  if (!text || !supported()) return;
  stopSpeaking();
  // Chrome drops an utterance queued in the same tick as cancel(), so hand it
  // over on the next one.
  pending = setTimeout(() => {
    pending = null;
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
          onEnd();
        };
        utterance.onend = settle;
        utterance.onerror = settle;
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      /* speech is optional — never block the screen on it */
    }
  }, 60);
}

export function stopSpeaking() {
  if (pending) {
    clearTimeout(pending);
    pending = null;
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
