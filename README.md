# Smriti

Offline-first cognitive-engagement and memory-assistance PWA for elderly
dementia patients in the North-Eastern Region.

**This is an engagement and support tool. It is not a diagnostic device, not a
medical device, and not treatment.** Nothing in it measures or infers a
cognitive condition; it reports activity performance only.

## Running it

Must be served over `http://` — `file://` breaks fetch, the manifest and the
service worker.

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

| Page | Purpose |
|---|---|
| `/` | the app |
| `/tools/demo.html` | seed demo data; render every screen and report anything that throws |
| `/tools/store-test.html` | persistence self-test, including across a page reload |
| `/tools/voice-test.html` | voice handover check — run it on the demo phone |

Run `tools/demo.html` → **Render every screen** after any change. It is the
only automated check that the whole app executes.

## Stack

Vanilla JavaScript, no framework, no build step, no runtime CDN dependency.
The last one is a hard constraint, not a preference: a CDN request breaks
airplane-mode operation, which the app is required to support.

- ES modules, hash router (`js/core/router.js`)
- IndexedDB via `js/core/store.js`, with a localStorage mirror as fallback for
  old Android browsers. Reads are synchronous against a cache hydrated once at
  boot, so screens render without awaiting.
- Service worker precaches the whole shell including every image.
  **Bump `CACHE_NAME` in `sw.js` on every change** or devices keep serving the
  old build.
- Charts are hand-built inline SVG (`js/core/chart.js`).

## Layout

```
index.html  manifest.json  sw.js
content/    en.json, as.json — every user-visible string
css/        base.css (design system), patient.css, caregiver.css
js/core/    store, router, dom, voice, content, format, adaptive, analytics, chart
js/screens/ entry, patient/*, caregiver/*
assets/     images (activity artwork), icons
tools/      demo seeding and smoke tests — not part of the app or its cache
```

## What is built

**Five activities**, covering every cognitive domain the brief names:

| Domain | Activity |
|---|---|
| Memory | Reminiscence recall |
| Object recognition | Matching |
| Attention and concentration | Spot-the-object |
| Daily routine recall | Put the routine in order |
| Pattern recognition | What comes next |

Rules shared by all of them: the prompt is spoken on entry, a wrong answer
never skips the round, there are no timers, no scores shown to the patient and
no fail states.

**One line at a time.** A line belongs to the screen that started it, and
leaving that screen ends it — the router stops speech and the microphone on
every route change, and the exercises session does the same between rounds.
A line that was cut off must stay cut off: it never falls back to the device
engine to say itself again, and it never reports that it finished, because a
screen that advances on a sentence the patient never heard is the same bug
wearing a different hat. `tools/voice-test.html` checks all of this against
real audio timing, which is why it has to run on the phone.

**Adaptive difficulty** — `js/core/adaptive.js`. Three correct in a row moves
up, two wrong eases back, and at the easiest level it repeats rather than
dropping further. It responds to activity performance only. There is no ML and
no cloud; it is a rules engine, and the caregiver screen describes it as one.

**Reminders** for medicine, hydration, activities and appointments, with a
full-screen card the patient acknowledges. The watcher polls while the app is
open, so a reminder arrives on time rather than only when Home is redrawn.
It cannot fire while the app is closed — that needs an OS-level alarm, which a
page cannot register without a server.

**Caregiver side** — Overview with alerts, Reminders manager, Engagement with a
14-day practice chart and per-activity accuracy and level trends, Memories &
Settings with photo management, language, starting level and backup.

**Languages** — English and Assamese, structurally identical packs. A third is
a drop-in `content/<code>.json` plus an entry in `app.languages`; no code
changes. Each pack declares an ordered `speechLang` chain, and Assamese falls
back to Bengali because Android rarely carries an Assamese voice and Assamese
is written in the Bengali-Assamese script. Caregiver Settings reports which
voice the device actually found.

**Backup** — the whole device state to a JSON file and back. This is the
offline, no-account answer to moving a patient's information between devices.

## Deliberately not built

Accounts, authentication, encryption, cloud sync, real ML, cognitive-condition
inference, and multi-patient health-worker workflows. These are roadmap, and
should be presented that way rather than implied to exist.

The Patient/Caregiver split is a **UX gate, not authentication**: the two-second
hold exists so a confused patient cannot wander into the caregiver screens. It
is not a security boundary, and all data is local to one device.

There are two holds that cross over — the dim corner on Patient Home, and the
Home icon on any patient screen. Both fill as they are held, which is what gives
someone who did not mean it time to let go. The Home icon carries the greater
risk of the two, being the control the patient is taught to use, and a tap on it
still simply goes Home. `?caregiver=1` adds a plain labelled button to Patient
Home for presenting; it is absent without the flag.

## Before demonstrating

1. Run `tools/demo.html` → *Render every screen*, then *Load demo data*.
2. Have a native Assamese speaker review `content/as.json`. The strings are
   machine-authored and unreviewed.
3. On the actual demo device: check that a voice exists (Caregiver → Settings
   reports it), test airplane mode after one load, and install to the home
   screen to confirm it launches standalone.

## Language and claim discipline

Enforced in all user-visible copy. Never "cognitive score", "brain score",
"improves cognition", "detects", "diagnoses" or "clinically proven". Use
"engagement", "activity performance", "session history", "practice activities".
The activities are called exercises or activities, never games.
