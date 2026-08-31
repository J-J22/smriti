#!/usr/bin/env python3
"""Pre-render every fixed patient-facing line as an audio file.

The app leads with its voice, and speechSynthesis on a low-end Android sounds
like a robot reading a form. Every patient-facing line lives in a content pack
and never changes at runtime, so there is no reason to synthesise it live: this
renders each one once with a neural voice and ships the audio.

At runtime the app plays a file. Nothing is fetched, nothing is synthesised, and
the voice is identical on every device — which also removes the demo-day risk of
landing on a phone whose TTS engine is missing or slow to wake.

Lines containing a {placeholder} are skipped on purpose: they are assembled at
runtime from a name or a time, so voice.js falls back to speechSynthesis for
those. Everything else gets a file.

    uv run --with edge-tts tools/build-voice.py            both languages
    uv run --with edge-tts tools/build-voice.py --lang en  just English
    uv run --with edge-tts tools/build-voice.py --voices   list what is available

Writes assets/audio/<lang>/*.mp3 plus an index.json mapping each line to its
file and its duration.
Re-running only renders what is missing or has changed.
"""

import argparse
import asyncio
import hashlib
import io
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Only the patient side is spoken aloud; the caregiver screens are read, not
# heard. Keeping the set small keeps the precache small.
SPOKEN_SECTIONS = ('entry', 'patient')

# Assamese neural voices do not exist. Assamese is written in the
# Bengali-Assamese script, so a Bengali voice pronounces it far closer than any
# Latin-script voice — the same reasoning voice.js already uses for its live
# fallback chain.
VOICES = {
    'en': 'en-IN-NeerjaNeural',
    'as': 'bn-IN-TanishaaNeural',
}

# A little slower than default: these users need time, and the app is never in
# a hurry. Matches the RATE in js/core/voice.js.
RATE = '-10%'


def collect(pack):
    """Every distinct speakable line, in a stable order."""
    lines = []

    def walk(node):
        if isinstance(node, dict):
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)
        elif isinstance(node, str):
            text = node.strip()
            # '{' marks a line assembled at runtime — it cannot be pre-rendered,
            # and voice.js will speak those live instead. Single characters are
            # decorative marks, not speech: the app's logo glyph is one, and the
            # service returns no audio for it.
            if text and '{' not in text and len(text) > 1 and any(ch.isalpha() for ch in text):
                lines.append(text)

    for section in SPOKEN_SECTIONS:
        walk(pack.get(section, {}))

    seen, unique = set(), []
    for line in lines:
        if line not in seen:
            seen.add(line)
            unique.append(line)
    return unique


def filename(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12] + '.mp3'


def duration_ms(path):
    """How long the clip actually runs.

    The patient screens advance on a fixed ceiling if speech never reports back,
    and a recording longer than that ceiling would be cut off mid-sentence. The
    app raises the ceiling per line using this, so the timing follows the audio
    instead of a guess. Falls back to 0, which leaves the old ceiling in place.
    """
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'csv=p=0', path],
            capture_output=True, text=True, timeout=20)
        return int(round(float(out.stdout.strip()) * 1000))
    except Exception:                                   # noqa: BLE001
        return 0


async def render(text, voice, path):
    import edge_tts
    communicate = edge_tts.Communicate(text, voice, rate=RATE)
    await communicate.save(path)


async def build(language, voice, force):
    pack_path = os.path.join(ROOT, 'content', language + '.json')
    if not os.path.exists(pack_path):
        print('no content pack at %s' % pack_path)
        return 1

    pack = json.load(io.open(pack_path, encoding='utf-8'))
    lines = collect(pack)
    out_dir = os.path.join(ROOT, 'assets', 'audio', language)
    os.makedirs(out_dir, exist_ok=True)

    print('%s: %d lines, voice %s' % (language, len(lines), voice))
    index, rendered, skipped, failed = {}, 0, 0, 0

    for number, text in enumerate(lines, 1):
        name = filename(text)
        path = os.path.join(out_dir, name)

        if os.path.exists(path) and os.path.getsize(path) > 0 and not force:
            index[text] = {'f': name, 'ms': duration_ms(path)}
            skipped += 1
            continue
        try:
            await render(text, voice, path)
            index[text] = {'f': name, 'ms': duration_ms(path)}
            rendered += 1
            print('  [%3d/%d] %s  %s' % (number, len(lines), name, text[:52]))
        except Exception as error:                      # noqa: BLE001
            failed += 1
            print('  [%3d/%d] FAILED %s — %s' % (number, len(lines), text[:40], error))
            if os.path.exists(path):
                os.remove(path)
            index.pop(text, None)

    # Any file no longer referenced by the pack is stale — drop it so the
    # precache never carries audio for a line that was edited or removed.
    keep = set(entry['f'] for entry in index.values())
    for existing in os.listdir(out_dir):
        if existing.endswith('.mp3') and existing not in keep:
            os.remove(os.path.join(out_dir, existing))
            print('  removed stale %s' % existing)

    # voice.js looks lines up by their exact text, so no hashing is needed in
    # the browser — SubtleCrypto is unavailable over plain http on a LAN
    # address, which is exactly how the demo phone will load the app.
    with io.open(os.path.join(out_dir, 'index.json'), 'w', encoding='utf-8') as handle:
        json.dump(index, handle, ensure_ascii=False, indent=0, sort_keys=True)

    total = sum(os.path.getsize(os.path.join(out_dir, f))
                for f in os.listdir(out_dir) if f.endswith('.mp3'))
    print('%s: %d rendered, %d already present, %d failed — %.1f MB total\n'
          % (language, rendered, skipped, failed, total / 1048576))
    return 1 if failed else 0


async def list_voices(prefix):
    import edge_tts
    for voice in await edge_tts.list_voices():
        if not prefix or voice['ShortName'].startswith(prefix):
            print('%-32s %-8s %s' % (voice['ShortName'], voice['Gender'], voice['Locale']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lang', action='append', choices=sorted(VOICES),
                        help='language pack to build (default: all)')
    parser.add_argument('--voice', help='override the voice for a single --lang')
    parser.add_argument('--force', action='store_true',
                        help='re-render lines that already have a file')
    parser.add_argument('--voices', nargs='?', const='', metavar='PREFIX',
                        help='list available voices and exit, e.g. --voices en-IN')
    args = parser.parse_args()

    try:
        import edge_tts                                  # noqa: F401
    except ImportError:
        print('edge-tts is not installed. Run this instead:\n'
              '  uv run --with edge-tts tools/build-voice.py')
        return 2

    if args.voices is not None:
        asyncio.run(list_voices(args.voices))
        return 0

    languages = args.lang or sorted(VOICES)
    if args.voice and len(languages) != 1:
        print('--voice applies to one --lang at a time')
        return 2

    status = 0
    for language in languages:
        voice = args.voice or VOICES[language]
        status |= asyncio.run(build(language, voice, args.force))
    return status


if __name__ == '__main__':
    sys.exit(main())
