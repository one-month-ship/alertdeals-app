#!/bin/bash
set -e

VAR_NAME="$1"
PREVIEW_FILE="packages/db/supabase/.env.preview"
SOURCES=(".env" ".env.local" ".env.development.local")

if [ -z "$VAR_NAME" ]; then
  echo "Usage: pnpm encrypt:var <VAR_NAME>" >&2
  exit 1
fi

# Find the value: later sources override earlier ones (matches dotenvx load order).
VALUE=""
FOUND_IN=""
for SRC in "${SOURCES[@]}"; do
  [ -f "$SRC" ] || continue
  # Match `KEY=...` (allow leading whitespace, ignore commented lines).
  LINE=$(grep -E "^[[:space:]]*${VAR_NAME}=" "$SRC" | tail -n 1 || true)
  [ -z "$LINE" ] && continue
  RAW="${LINE#*=}"
  # Strip surrounding double quotes if present.
  RAW="${RAW%\"}"
  RAW="${RAW#\"}"
  VALUE="$RAW"
  FOUND_IN="$SRC"
done

if [ -z "$FOUND_IN" ]; then
  echo "✗ $VAR_NAME not found in: ${SOURCES[*]}" >&2
  exit 1
fi

echo "→ Found $VAR_NAME in $FOUND_IN"
echo "→ Encrypting into $PREVIEW_FILE..."
npx dotenvx set "$VAR_NAME" "$VALUE" -f "$PREVIEW_FILE"
echo "✓ Done."
