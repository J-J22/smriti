# CLAUDE.md — Smriti

Standing rules for this project. Read fully at the start of every session.
Do not deviate without me explicitly asking.

## What this is
Offline-first cognitive-ENGAGEMENT and memory-assistance PWA for elderly dementia
patients in North-East India. Hackathon prototype (demo date Sep 5). It is an
engagement/support tool — NOT a diagnostic or medical device, NOT treatment.

## Terminology (user-facing)
- Call the activities "exercises" or "activities" everywhere the USER sees them.
  NEVER "games" in any user-visible text. (Internal code variable names don't matter.)
- These user-facing words live in content/en.json, not hardcoded.

## Stack (non-negotiable)
- Pure vanilla JavaScript PWA. NO framework, NO build step, NO TypeScript.
- Plain HTML/CSS/JS. Must run smoothly on low-end Android (~1GB RAM, old browsers).
- Offline-first: service worker + IndexedDB. Fully functional in airplane mode after first load.
- Installable PWA: manifest + service worker; launches full-screen standalone.
- Voice: Web Speech API. speechSynthesis (TTS) is core, used on every screen.
  SpeechRecognition (STT) is OPTIONAL, exercises-only, and must NEVER be required to advance/navigate.
- No runtime CDN dependency. Precache all /assets/images so they work offline. Keep images small.
- MUST be served over http:// (never file://) — fetch/manifest/service worker break on file://.

## No login
- No authentication, no accounts, no passwords anywhere in the demo.
- Entry screen is a ROLE TOGGLE (Patient / Caregiver), not a sign-in.
- All data is local to the one device.
- (Accounts, encryption, cloud sync = pitch-only future scope, do NOT build.)

## Two worlds (core architecture)
Two strictly separated view trees, joined only at the Entry screen.

### Patient side — on rails
- Linear, voice-led. No menus, no tabs, no back button, no user-managed history within exercises.
- Every screen: ONE task, ONE class of large touch target, huge fonts, high contrast, no clutter.
- App SPEAKS every prompt aloud automatically on screen entry (voice leads).
- NO timers. NO scores shown to patient. NO fail states.
- One persistent Home (house) icon, same corner every screen, hard-resets to Patient Home.
- No swipe/pinch/long-press/multi-touch in normal use. Single large taps only.

### Caregiver side — normal UI
- Normal navigable interface with a menu and back navigation. Data density is fine.
- Entered via Entry screen, OR via a dim, low-contrast corner element on Patient Home
  requiring a ≥2s long-press (so a confused patient can't stumble in). This long-press is
  a UX gate, NOT authentication.

## Claim discipline (enforce in ALL user-visible copy)
- NEVER: "cognitive score", "cognitive health", "brain score", "improves cognition",
  "detects", "diagnoses", "measures cognition", "clinically proven", "prevents/reverses dementia".
- USE: "engagement", "activity performance", "session history", "practice activities".
- Include a subtle "This is not a diagnostic tool — consult a professional for concerns"
  note in the caregiver section.

## Content as data
- All prompts, questions, image paths, labels, audio strings live in JSON content packs
  (content/en.json), never hardcoded.
- English only for now, structured so a second language is a drop-in JSON pack + a toggle.
  No code changes needed to add a language.

## Adaptive difficulty (the "AI" — honest version)
- Simple offline RULES engine: 3 correct in a row → harder; 2 wrong → easier/repeat.
- NO LLM, NO cloud, NO ML model. Must run fully offline.
- Runs INVISIBLY between rounds in exercises. Its state is SHOWN in the caregiver
  Engagement section as the honest adaptive story. Never present it as measuring cognition.
- Adapts to PERFORMANCE only. Do NOT attempt to infer "cognitive condition" (future scope).

## COMPLETE NAVIGATION MAP — every button leads to a real layer, no dead ends

ENTRY
- [Patient] -> Patient Home
- [Caregiver] -> Caregiver Dashboard

PATIENT HOME (3 big cards: Today, Let's Exercise, My Memories)
- [Today] -> Today layer
- [Let's Exercise] -> Exercises Session (intro)
- [My Memories] -> Memories Browser
- [Home icon] (persistent) -> Patient Home
- long-press dim corner -> Caregiver Dashboard
- reminder card auto-appears when due -> [Done] dismisses + logs -> Patient Home

TODAY layer
- speaks greeting + next reminder on entry
- [Home icon] -> Patient Home

MEMORIES BROWSER
- shows family photos + names, speaks each
- [Next]/[Previous] -> move through photos
- [Home icon] -> Patient Home

EXERCISES SESSION (linear, self-advancing)
- Intro -> auto-advance
- Exercise 1 (Reminiscence recall) -> answer -> feedback -> auto-advance
- Exercise 2 (Matching) -> answer -> feedback -> auto-advance
- Exercise 3 (Spot-the-object) -> answer -> feedback -> auto-advance
- Praise -> auto-return to Patient Home
- [Home icon] on every exercise screen -> Patient Home (safe exit anytime)

CAREGIVER DASHBOARD (menu, 4 sections)
- [Overview] -> Overview layer
- [Reminders] -> Reminders Manager
- [Engagement] -> Engagement layer
- [Memories & Settings] -> Memories/Settings layer
- [Switch to Patient] -> Patient Home

REMINDERS MANAGER
- list of reminders
- [Add] -> form (type: medicine/hydration/activity/appointment, time) -> save -> list
- tap reminder -> edit -> save/delete -> list
- [Back] -> Caregiver Dashboard

ENGAGEMENT layer
- per-exercise history + current difficulty per exercise (this is where the AI is shown)
- [Back] -> Caregiver Dashboard

MEMORIES & SETTINGS
- [Add photo] -> upload photo + type name -> saves (feeds Memories Browser + Exercise 1)
- language toggle -> switches language
- difficulty setting -> sets baseline
- privacy note ("not a diagnostic tool")
- [Back] -> Caregiver Dashboard

## Correct behaviors (fix the known bugs)
- A WRONG answer must NOT skip/advance. It stays on screen, gently shows the correct
  option ("Good try — this one!"), then advances. Never skip through on repeated wrong taps.
- The exercises session MUST transition correctly between all three exercises (1->2->3->praise).
  No exercise may be unreachable.
- Every button must route to its real layer. No dead ends, no "coming soon" stubs.
  Local actions must actually work (Add Reminder adds; Add Photo shows; difficulty toggle applies).

## Folder structure
index.html, /js, /css, /content (JSON packs), /assets/images, manifest.json, service worker.

## BUILD ORDER (follow strictly)
1. App shell + ALL navigation wired: every button routes to a real (even if bare) screen,
   so the whole app is clickable end-to-end with no dead ends. Show me this first.
2. Patient Home + Today + reminder pop-up behavior.
3. ONE exercise, fully polished and correct (proper wrong-answer handling). Let me review it
   as the gold standard BEFORE building the others.
4. Replicate that quality to Exercise 2 and 3.
5. Memories Browser.
6. Caregiver: Overview -> Reminders Manager -> Engagement -> Memories/Settings.
7. Polish, offline test (serve over http, airplane-mode check), pre-load.

## Out of scope (do NOT build — pitch only)
Login/accounts/auth · encryption · cloud sync · real ML · cognitive-condition inference ·
AOSP/locked-device OS · health-worker multi-patient workflow.

## Working style
- Build strictly in the BUILD ORDER above. Do the shell + navigation FIRST and stop for review.
- Explain folder structure before writing logic.
- Build ONE exercise fully, let me review the pattern, THEN replicate.
- Small, reviewable steps. Commit to git at each working checkpoint.
- Serve over http:// for testing; never assume file:// works.
