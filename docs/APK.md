# Packaging Smriti as an Android APK

Runbook. Written before the first build, then corrected against it. The build
described here has been made, installed and launched on a Galaxy A23 (SM-A235F,
Android 14, API 34, WebView 151) and on a Lenovo TB-7304I (Android 7.0, API 24,
918 MB RAM, system WebView Chrome 58, never updated). The Lenovo is the device
the pitch is about, and it is the one that forced section 4a. Anything still
unverified is marked as such.

**The rule this document exists under:** the PWA remains the demo path until the
APK has passed the same device checklist. Building the APK does not retire the
PWA, and an untested APK is not a deliverable.

---

## 1. Why Capacitor and not a TWA

PWABuilder and Bubblewrap produce a **Trusted Web Activity**: a thin wrapper that
loads a hosted HTTPS URL, verified by an `assetlinks.json` file on that domain.
Two problems for this project — it needs a domain and hosting we do not have, and
it fetches the app over the network on first launch.

Capacitor copies the web assets **into the package**. The app is on the device
from first launch, with no download, no service worker, no cache eviction and no
first-play condition on the Assamese audio. That is the entire reason to package
this app, so Capacitor is the only option that delivers it.

**Cost to be honest about:** Capacitor introduces npm and the Android SDK as
*build-time* dependencies. It changes no shipped JavaScript, and the web app
still has no build step — but `CLAUDE.md` lists "no build step" as
non-negotiable, and this is the edge of that rule. It was a deliberate call, not
an oversight.

---

## 2. Prerequisites

```bash
sudo pacman -S nodejs npm jdk21-openjdk rsync unzip android-tools android-udev
```

Android SDK command-line tools: download the Linux zip from
<https://developer.android.com/studio#command-line-tools-only> (the build number
in the filename changes; take the current one). It **must** end up at
`cmdline-tools/latest/`, not `cmdline-tools/`, or `sdkmanager` will not run:

```bash
mkdir -p ~/Android/Sdk/cmdline-tools
unzip ~/Downloads/commandlinetools-linux-*.zip -d /tmp/cmdline
mv /tmp/cmdline/cmdline-tools ~/Android/Sdk/cmdline-tools/latest
```

**JDK 21, not 17.** Capacitor 8 pins `JavaVersion.VERSION_21`
(`node_modules/@capacitor/android/capacitor/build.gradle:66`); building on 17
fails with `invalid source release: 21`. Arch installs JDKs side by side, so
keeping 17 for other work is fine.

Environment — add to `~/.bashrc`, then open a new shell:

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
```

Then:

```bash
sdkmanager --licenses           # accept all
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

Roughly 3–4 GB of downloads. This is the longest step and the one whose duration
depends on your connection, not on the work.

---

## 3. Scaffold

From the repo root:

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init Smriti in.smriti.app --web-dir=www
```

`in.smriti.app` is the package id. It is permanent for the life of a Play
listing, so pick it deliberately even if you never publish.

Add to `.gitignore` — none of this belongs in the repo:

```
node_modules/
www/
android/
package-lock.json
```

---

## 4. Stage the web assets

Capacitor copies `webDir` wholesale, so it must hold the app and nothing else.
`tools/stage-web.sh` builds it:

```bash
tools/stage-web.sh          # writes ./www, ~7.4 MB
```

It excludes `.git`, `docs/`, `node_modules/`, `android/` and — importantly —
**`tools/`**, which contains the demo seeder and its wipe-everything button.
That must never ship inside a build a judge can hold.

It then bundles the JavaScript (next section) and rewrites the script tag in
the staged `index.html`. The script fails loudly if either step did not happen.

Re-run it after **every** change to the app, before `cap sync`. Forgetting is
the Capacitor equivalent of forgetting to bump `CACHE_NAME`, and it presents the
same way: your change is missing and nothing says why.

---

## 4a. Why the package gets a bundle, and the PWA does not

The app is written as ES modules: `<script type="module" src="js/app.js">`.
Module scripts need Chrome 61. The Lenovo TB-7304I ships Chrome 58 as its
system WebView, its standalone WebView package is a disabled stub, and the Play
Store never updates it — so it never even *requests* the JavaScript and paints
a blank cream page. Served over the LAN, the server log showed HTML, CSS and
icon fetched, and zero JS. That is the entire failure.

Devices like this are the point of the project, so "update Chrome" is not an
answer. The fix lives in `tools/stage-web.sh` and touches only the staged copy:

- **esbuild** (a dev dependency, installed by `npm install`) bundles the modules
  into one classic script at `www/js/app.js`, target `chrome58`, so syntax newer
  than that is lowered. `async`/`await` and arrow functions are left native;
  Chrome 58 has them.
- `import.meta.url` does not exist in a classic script. The two modules that use
  it resolve paths relative to `js/core/`, so the bundle defines it as that URL
  relative to the script's own location.
- The staged `index.html` loads `<script src="js/app.js" defer>`; the leftover
  `www/js/core` and `www/js/screens` directories are removed.
- `capacitor.config.json` sets `minWebViewVersion: 55` so Capacitor stops
  logging that the WebView is unsupported (it never actually refused to load —
  without `errorPath` it only logs).

The PWA source is untouched and still has no build step: served from the repo,
it is the same module files it always was. The bundle exists only inside the
package. If you ever add syntax to the app, the bundle absorbs it; if you add an
*API* (a new `navigator.*`, a new array method), esbuild cannot polyfill it, and
Chrome 58 is the floor to check against.

**CSS on Chrome 58.** Three fallbacks live in the source, all no-ops on a
modern browser:

- `inset: 0` is preceded by `top/right/bottom/left: 0` (Chrome 87 for `inset`).
- The one grid gets `grid-gap` before `gap` (`gap` on grid is Chrome 66).
- Flex `gap` (Chrome 84) is rebuilt from margins in a `@supports not (gap: 1px)`
  block at the end of `patient.css` and `caregiver.css`. Add a new flex
  container with `gap`, add a line there, or Chrome 58 collapses its spacing.
- `button:focus { outline: none }` sits before the `:focus-visible` rule, because
  a browser that cannot parse `:focus-visible` would otherwise paint its default
  ring on every tap.

Verified on the Lenovo: entry, patient home, all exercises, caregiver overview,
bundled audio playing without a gesture, no console errors over a session of
taps. `speechSynthesis` is simply absent in this WebView (not just voiceless),
which the app already handles.

---

## 5. Build

```bash
npx cap add android          # first time only
tools/stage-web.sh && npx cap sync android
cd android && ./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

First Gradle run downloads its own distribution — another few hundred MB, and it
looks stalled when it is not.

A debug APK is signed with a throwaway debug key. That is fine for sideloading
and for the demo. A release APK needs a keystore you generate and must not lose;
do that only if you are publishing.

---

## 6. Install on the phone

No adb required, which matters while `chrome://inspect` is uncooperative:

1. Connect USB, set the phone's USB mode to **File Transfer**
2. Copy `app-debug.apk` to the phone's Download folder
3. On the phone, open Files → Downloads → tap the APK
4. Allow **Install unknown apps** for the Files app when prompted

With adb working it is one command instead:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 7. What to check, in this order

The web behaviour is already verified; only WebView differences are unknown.

- [x] App launches full-screen, portrait — verified on the A23 and the Lenovo
- [x] Entry and Patient Home render, no JavaScript errors — verified on both
- [x] Exercises and caregiver overview render with correct spacing on Chrome 58
      — verified on the Lenovo (section 4a)
- [ ] Correct icon on the launcher
- [ ] **Airplane mode from the very first launch** — the whole point of packaging
- [x] English audio plays inside the WebView with no gesture — verified on the
      Lenovo by playing a bundled clip from DevTools; not yet checked on every
      screen by ear
- [ ] **Assamese audio offline with no prior online use** — impossible in the PWA,
      expected to work here
- [ ] Templated lines ("Tap the gamosa", "It is time for medicine") — these need
      the device TTS engine, which WebView may not expose. Caregiver → Settings
      should show an amber dot and say so if not
- [ ] Exercise 1 microphone — expected to be **absent**, see below
- [ ] Photo upload: file picker and camera
- [ ] Backup: save a file, wipe, restore
- [ ] Both crossover holds with a real thumb
- [ ] Reminder card fires while the app is open

---

## 8. Known WebView differences

**SpeechRecognition does not exist in Android WebView.** `listen.js` guards on
`window.SpeechRecognition || window.webkitSpeechRecognition` and reports
`unsupported`, so this should degrade cleanly — verify the microphone button is
absent rather than present and dead. Speech input is optional by design and
never required to advance, so its absence is not a defect.

**speechSynthesis may be unavailable or carry no voices.** Largely mitigated:
every fixed line is a bundled recording. Only the ten templated lines need an
engine, and the caregiver readout now reports that state honestly.

**The service worker is worse than redundant — fixed, keep it fixed.**
Capacitor serves from `https://localhost`, a secure context, so the worker
registers and precaches all 380 clips into CacheStorage: a second copy of files
already in the APK. Measured on the A23 at **7.9 MB against an 11 MB package**,
plus 380 file reads per cold start.

`js/app.js` now skips registration when `window.Capacitor` is defined and clears
anything an earlier build left. App data fell from 12.6 MB to 628 KB, launch
audio requests from 380 to 2. `window.Capacitor` is undefined in a browser, so
the PWA is unaffected.

If you ever see app data climb back toward 12 MB, that guard has been lost.

**Audio autoplay** may be blocked without a user gesture. The entry-screen tap
probably unlocks it; if not, the relevant knob is Capacitor's Android WebView
media-gesture setting.

**Photo picker.** The generated manifest declares only `INTERNET`; there is no
`READ_MEDIA_IMAGES`. An earlier draft of this runbook claimed there was, and it
was wrong. A plain `<input type="file" accept="image/*">` goes through
Capacitor's file chooser, which may not need the permission on Android 13+, but
this is untested — it is the item on the checklist above most likely to need a
manifest line adding. `android/` is generated by `npx cap add android`, so any
line added there must also be recorded here or the next clone loses it.

**Backup download** is the most likely thing to break. A blob `<a download>` has
no browser download manager behind it in a WebView. If it fails, the fix is
`@capacitor/filesystem` plus the share sheet — which is arguably better UX than
a silent file drop anyway.

**Debugging the WebView** uses `chrome://inspect` with the app running, or,
without a desktop Chrome, the raw DevTools socket over adb:

```bash
adb shell cat /proc/net/unix | grep -a devtools     # webview_devtools_remote_<pid>
adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>
curl -s http://127.0.0.1:9223/json                  # page targets + websocket URLs
```

Anything you `Runtime.evaluate` over that socket runs in the *device's* engine:
no `?.`, no `??` on Chrome 58. The tablet also needs the **Allow USB debugging**
prompt accepted; until then `adb devices` shows it as `unauthorized`.

---

## 9. Estimated time

| Step | Estimate |
|---|---|
| Toolchain and SDK | ~10 min on a fast connection (173 MB in 18 s here); 1–3 h on a slow one |
| Scaffold and stage | 5 min |
| First successful build | ~2 min once the JDK is right; Gradle self-downloads on run one |
| Install and launch | 2 min |
| WebView fixes | 2 found and fixed (service worker; Chrome 58 bundle + CSS); photo picker and backup still unverified |

APK size: roughly 12–15 MB; the 6.5 MB of audio dominates.
