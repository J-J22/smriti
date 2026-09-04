# Smriti

Offline-first cognitive-engagement and memory-assistance PWA for elderly
dementia patients in the North-Eastern Region.

**This is an engagement and support tool. It is not a diagnostic device, not a
medical device, and not treatment.** Nothing in it measures or infers a
cognitive condition; it reports activity performance only.

## Set it up on your own device

Everything the app needs is in this repository: all the artwork, both content
packs and all 380 recorded voice clips. There is nothing to install, no build
step and no API key. Clone it, serve it over HTTP, open it.

**It must be served over `http://`.** Opening `index.html` from the file system
does not work — `file://` breaks `fetch`, the manifest and the service worker,
so you get a blank screen. This is the single most common way to conclude the
app is broken when it is not.

### 1. Get it and serve it

```bash
git clone https://github.com/J-J22/smriti.git
cd smriti
```

Then start any static server on the repository root. Pick whichever you have:

```bash
python3 -m http.server 8000                 # Python 3, no install
npx --yes serve -l 8000 .                   # Node
docker compose up --build                   # nginx, also on 8000
```

Open <http://localhost:8000/>. You should land on the Entry screen with two
buttons, Patient and Caregiver. On first run the app seeds two weeks of sample
data so no screen opens empty; a banner in Caregiver → Memories & Settings says
so and clears it in one tap.

The Docker option builds the same nginx configuration used for deployment,
which sets the cache headers the service worker needs. The other two are fine
for development and are what most people should use.

### 2. Test it in the browser

Everything works on a laptop except the microphone quirks and real touch. Walk
this path:

1. **Patient → Today.** It should speak the next reminder aloud within a second.
2. **Patient → Let's Exercise.** Nine rounds across five activities, spoken
   prompts, auto-advancing. Deliberately tap a **wrong** answer: the round must
   say "Not quite, try again" and stay put. It must never skip.
3. **My Memories.** Each photo is named aloud; Previous wraps to the last photo.
4. **Hold the Home icon for two seconds.** A ring fills and the caregiver
   dashboard opens. A short tap just goes Home.
5. **Caregiver → Engagement.** A 14-day chart and one card per activity, each
   with a dashed line showing what the on-device learner expected against what
   actually happened.
6. **Caregiver → Memories & Settings.** Switch the language to অসমীয়া and back;
   the whole app including the voice changes. Check the Voice row reports what
   your machine actually found.

If a two-second one-handed hold is awkward while presenting, open the app as
<http://localhost:8000/?caregiver=1> and a plain labelled caregiver button
appears on Patient Home. It is absent without the flag, so a patient can never
meet it.

### 3. Test it offline

This is the claim worth verifying yourself, and it takes a minute:

1. Load the app once and let it sit for about thirty seconds. The service worker
   precaches the shell and both audio packs, roughly 7 MB.
2. Open DevTools → Application → Service Workers and confirm one is active.
3. Turn on **Offline** in DevTools, or stop the server, and reload.
4. Everything should still work, including the voice, in both languages.

### 4. Test it on a real phone

The phone is where this app actually lives, and some behaviour only exists
there: touch targets, the hold gesture, the device speech engine, and installing
to the home screen. Serve on your machine and reach it over the same Wi-Fi:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
ip -4 addr | grep inet          # find your LAN address, e.g. 192.168.1.6
```

On the phone open `http://192.168.1.6:8000/`. Then use the browser menu to
**Add to Home Screen**; it launches full-screen with no address bar. Turn on
airplane mode and open it again — it should work exactly the same.

One thing to know about a plain-HTTP LAN address: the browser treats it as an
insecure context, so speech *input* (the optional microphone in the first
activity) cannot run there. The button appears, the first tap fails, and the app
then removes the button and says "I didn't catch that, you can tap instead."
That is the designed degradation, not a fault. Everything else works, including
all spoken output, which is a separate mechanism.

### 5. The self-test pages

| Page | What it proves |
|---|---|
| `/tools/demo.html` | Renders every screen and reports anything that throws. Also seeds and clears demo data. |
| `/tools/store-test.html` | Persistence works, including across a page reload |
| `/tools/model-test.html` | The adaptive learner behaves as specified |
| `/tools/listen-test.html` | The speech matcher resolves 18 cases, 8 of which must match nothing |
| `/tools/voice-test.html` | The handover between recordings and the device engine, against real audio timing. Run this one on the phone. |

Run `tools/demo.html` → **Render every screen** after any change. It is the only
automated check that the whole app executes. `tools/` is development-only and is
deliberately excluded from any packaged build, because it contains a
wipe-everything button.

There is also `tools/model-harness.py`, which validates the learner against
synthetic patients. It reads the constants straight out of the JavaScript, so it
cannot drift from the shipped code:

```bash
python3 tools/model-harness.py
```

### 6. Building the Android package (optional)

Only needed if you want the APK. It is not required to test the app, and the
web version is the reference. It needs Node, JDK 21 and the Android SDK, and the
first run downloads several gigabytes.

```bash
npm install                          # Capacitor and esbuild
npx cap add android                  # first time only; android/ is generated
tools/stage-web.sh && npx cap sync android
cd android && ./gradlew assembleDebug
```

The result is `android/app/build/outputs/apk/debug/app-debug.apk`, about 11 MB.
`android/`, `www/` and `node_modules/` are all generated and therefore not in
this repository; the three commands above recreate them. Full instructions,
including why Capacitor rather than a Trusted Web Activity and how the build
targets a 2017 browser engine, are in **[docs/APK.md](docs/APK.md)**.

### If something looks wrong

| Symptom | Cause |
|---|---|
| Blank screen | Opened over `file://`. Serve over HTTP. |
| Changes do not appear | The service worker is serving the old shell. Hard-reload, or bump `CACHE_NAME` in `sw.js`. |
| No voice at all | Your machine has no speech engine and the recordings failed to load. Check the Voice row in Caregiver → Settings; it reports honestly. |
| Some lines silent, most fine | Expected on a device with no speech engine. Five lines are assembled at runtime from a name or a time and have no recording. |
| No microphone button | Correct in an Android WebView, after speech has failed once, or when the caregiver has turned speech answers off. It is optional by design and never needed to advance. |
| Reminder never fires | It only fires while the app is open. An alarm with the app closed needs the operating system, which a web page cannot register. |

## Documentation

| File | For |
|---|---|
| [docs/GUIDE.html](docs/GUIDE.html) | The full field guide: every feature, the code that implements it, the problems hit and how they were solved. Open it in a browser. |
| [docs/TECHNICAL.md](docs/TECHNICAL.md) | Feature-by-feature reference with file and line citations |
| [docs/DEFENSE.md](docs/DEFENSE.md) | The hard questions and honest answers, for presenting |
| [docs/APK.md](docs/APK.md) | Packaging as an Android APK, and the old-device work |
| [CLAUDE.md](CLAUDE.md) | The standing rules the project is built under |

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
js/core/    store, router, dom, voice, listen, content, format,
            adaptive, model, analytics, chart, demo-data
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

**Adaptive difficulty** — two layers. `js/core/adaptive.js` is the rules engine:
three correct in a row moves up, two wrong eases back, and at the easiest level
it repeats rather than dropping further. `js/core/model.js` is a learner sitting
on top of it — online logistic regression, trained by SGD on this device from
this one patient's rounds, steering toward a 75% success rate. It only watches
until it has enough rounds, and it may only ever pick a level adjacent to the
one the rules arrived at, so it can nudge but never leap.

Calling that machine learning is correct, and the honest description is **no
cloud ML, no LLM, no pretrained model, no downloaded weights** — ~100 lines of
arithmetic a clinician can audit. It predicts success in an activity and nothing
else: it responds to activity performance only and infers no cognitive state.

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

Accounts, authentication, encryption, cloud sync, server-side or downloaded ML,
cognitive-condition inference, and multi-patient health-worker workflows. These
are roadmap, and should be presented that way rather than implied to exist.
(The on-device learner above is not an exception to this: it ships no model file
and makes no network call.)

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
