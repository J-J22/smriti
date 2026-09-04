#!/usr/bin/env bash
# Copy just the shipping app into a staging directory for Capacitor.
#
# Capacitor copies one directory wholesale into the APK, so it must contain the
# app and nothing else: no .git, no docs, no node_modules, and none of tools/,
# which seeds demo data and would be a live wipe-everything button inside a
# shipped build.
#
# Usage:  tools/stage-web.sh [dest]      (default: ./www)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$ROOT/www}"

rm -rf "$DEST"
mkdir -p "$DEST"

rsync -a \
  --exclude='.git/' \
  --exclude='.gitignore' \
  --exclude='.dockerignore' \
  --exclude='docs/' \
  --exclude='tools/' \
  --exclude='node_modules/' \
  --exclude='android/' \
  --exclude='www/' \
  --exclude='package*.json' \
  --exclude='capacitor.config.*' \
  --exclude='Dockerfile' \
  --exclude='docker-compose.yml' \
  --exclude='nginx.conf' \
  --exclude='CLAUDE*.md' \
  --exclude='README.md' \
  "$ROOT/" "$DEST/"

# The app is written as ES modules, which need Chrome 61. The tablets this app
# is for can run a system WebView as old as Chrome 58, which never even requests
# a module script and paints a blank page. So the package gets one classic
# script instead: the modules bundled by esbuild, with syntax newer than Chrome
# 58 lowered. The PWA source is untouched and still has no build step; this is
# the packaging path only.
#
# `import.meta.url` does not exist in a classic script. The two modules that use
# it (content.js, voice.js) live in js/core/, so it is replaced with a URL that
# resolves there relative to the bundle's own location.
"$ROOT/node_modules/.bin/esbuild" "$ROOT/js/app.js" \
  --bundle --format=iife --target=chrome58 --log-level=warning \
  --define:import.meta.url=__SMRITI_MODULE_URL__ \
  --banner:js="var __SMRITI_MODULE_URL__ = new URL('core/', (document.currentScript && document.currentScript.src) || document.baseURI).href;" \
  --outfile="$DEST/js/app.js"
rm -rf "$DEST/js/core" "$DEST/js/screens"

# Load it as a classic deferred script, which keeps the run-after-parse timing
# a module script had.
sed -i 's|<script type="module" src="js/app.js"></script>|<script src="js/app.js" defer></script>|' "$DEST/index.html"
if ! grep -q '<script src="js/app.js" defer></script>' "$DEST/index.html"; then
  echo "ERROR: index.html script tag was not rewritten" >&2
  exit 1
fi
if grep -q 'type="module"' "$DEST/index.html"; then
  echo "ERROR: a module script tag survived in index.html" >&2
  exit 1
fi

echo "staged -> $DEST"
du -sh "$DEST"
echo
echo "sanity checks:"
for f in index.html manifest.json js/app.js sw.js content/en.json content/as.json \
         assets/audio/en/index.json assets/audio/as/index.json; do
  if [ -e "$DEST/$f" ]; then echo "  ok      $f"; else echo "  MISSING $f"; fi
done
echo "  audio clips: en=$(ls "$DEST/assets/audio/en"/*.mp3 2>/dev/null | wc -l) as=$(ls "$DEST/assets/audio/as"/*.mp3 2>/dev/null | wc -l)"
