# CLAUDE.md — Smriti

Standing rules for this project. Read fully at the start of every session. Do not deviate without me explicitly asking.

## What this is
Offline-first cognitive-ENGAGEMENT and memory-assistance PWA for elderly dementia patients in North-East India. Hackathon prototype. It is an engagement/support tool — NOT a diagnostic or medical device, NOT treatment.

## Stack (non-negotiable)
- Pure vanilla JavaScript PWA. NO framework, NO build step, NO TypeScript.
- Plain HTML/CSS/JS. Must run smoothly on low-end Android (~1GB RAM, old browsers).
- Offline-first: service worker + IndexedDB. Fully functional in airplane mode after first load.
- Installable PWA: manifest + service worker; launches full-screen standalone.
- Voice: Web Speech API. `speechSynthesis` (TTS) is core, used on every screen. `SpeechRecognition` (STT) is OPTIONAL, games-only, and must NEVER be required to advance or navigate.
- No runtime CDN dependency. Precache all `/assets/images` so they work offline. Keep images small.

## Two worlds (core architecture)
Two strictly separated view trees. Do not let one bleed into the other.

### Patient side — on rails
- A linear state machine, not a navigable app: Home → Intro → Game1 → Game2 → Game3 → Praise → Home.
- No menus, no tabs, no back button, no user-managed history.
- Every screen: ONE task, ONE class of large touch target, huge fonts, high contrast, no clutter.
- App SPEAKS every prompt aloud automatically on screen entry (voice leads).
- Answering advances. Auto-advance after the voice finishes or after an answer. No separate "next" button.
- NO timers. NO scores shown to patient. NO fail states. Wrong answers get gentle positive redirection ("Good try — this one!"), never "wrong"/red X.
- No swipe, pinch, long-press, or multi-touch. Single large taps only.
- One persistent Home (house) icon, same corner every screen, hard-resets to Home = the only recovery path.
- Tapping the prompt re-plays its audio.

### Caregiver side — normal UI
- Normal navigable interface with menu/tabs and back navigation. Data density is fine here.
- Entered ONLY via a dim, low-contrast corner element on patient Home requiring a ≥2s long-press — never a single tap. Exiting returns to patient Home. No stray links from patient screens into caregiver screens.

## Claim discipline (enforce in ALL UI copy)
- NEVER: "cognitive score", "cognitive health", "brain score", "improves cognition", "detects", "diagnoses", "measures cognition", "clinically proven", "prevents/reverses dementia".
- USE instead: "engagement", "activity performance", "session history", "practice activities".
- Include a subtle "This is not a diagnostic tool — consult a professional for concerns" note in the caregiver section.

## Content as data
- All prompts, questions, image paths, labels, and audio strings live in JSON content packs (`content/en.json`), never hardcoded.
- English only for now, but structured so a second language is a drop-in JSON pack + a toggle. No code changes should be needed to add a language.

## Adaptive difficulty
- Simple offline RULES engine: 3 correct in a row → harder; 2 wrong → easier/repeat.
- NO LLM, NO cloud, NO ML. Must run fully offline.
- Surface its current state in the caregiver dashboard as the honest "adaptive" story. Never present it as measuring cognition.

## MVP scope (this build)

### Patient flow — build first, make it flawless (English, placeholder images)
1. Home: spoken greeting + today's date + big "Begin" button (+ dim caregiver long-press corner).
2. Intro: spoken "let's play three little games", auto-advance.
3. Game 1 — Reminiscence recall (HERO): familiar photo + spoken question + 2 big picture answers.
4. Game 2 — Matching pairs: tap the two tiles that go together.
5. Game 3 — Spot-the-object: "tap the teapot" (spoken); tap the object among familiar items.
6. Praise: spoken encouragement, auto-return to Home (closes the loop).
- Reminders fire on the patient screen as a gentle spoken + visual card with a big "Done" tap.

### Caregiver side — later, sample data, NO backend / NO login
Overview · engagement history (per-domain, labelled "engagement") · adaptive-difficulty view · reminders manager (medicines/hydration/activities/appointments) · reminiscence content manager (photo + name stubs) · language + difficulty settings · patient profile + privacy note.

## Out of scope (do NOT build — pitch only)
AOSP/locked-device OS · health-worker multi-patient workflow · live cloud sync · real ML · required voice-input (STT) on any critical path.

## Folder structure
`index.html`, `/js`, `/css`, `/content` (JSON packs), `/assets/images`, `manifest.json`, service worker.

## Working style
- Build the patient flow end-to-end FIRST. Stop and show the running patient flow before building the caregiver side.
- Explain folder structure before writing game logic.
- Build ONE game fully, let me review the pattern, THEN replicate to the others.
- Small, reviewable steps over large multi-feature dumps.
- Commit to git at each working checkpoint.
