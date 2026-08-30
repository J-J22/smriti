// TTS leads every patient screen. Speech is a one-way aid: nothing in the app
// ever waits on it, so a device with no voice engine still works normally —
// callers always pair onEnd with their own fallback timer.

const RATE = 0.9; // a little slower than default, easier to follow
let pending = null;

function supported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
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
      utterance.lang = document.documentElement.lang || 'en';
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
