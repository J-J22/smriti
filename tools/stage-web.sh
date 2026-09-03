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

echo "staged -> $DEST"
du -sh "$DEST"
echo
echo "sanity checks:"
for f in index.html manifest.json js/app.js content/en.json content/as.json \
         assets/audio/en/index.json assets/audio/as/index.json; do
  if [ -e "$DEST/$f" ]; then echo "  ok      $f"; else echo "  MISSING $f"; fi
done
echo "  audio clips: en=$(ls "$DEST/assets/audio/en"/*.mp3 2>/dev/null | wc -l) as=$(ls "$DEST/assets/audio/as"/*.mp3 2>/dev/null | wc -l)"
