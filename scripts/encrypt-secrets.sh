#!/bin/bash
set -e

PREVIEW_FILE="packages/db/supabase/.env.preview"

echo "→ Encrypting secrets to $PREVIEW_FILE..."

# Pull values from the root .env files (committed + personal local).
# These are the only sources of truth in the monorepo.
SOURCES=(".env" ".env.local" ".env.development.local")

for SRC in "${SOURCES[@]}"; do
  if [ -f "$SRC" ]; then
    echo "→ Adding $SRC..."
    while IFS='=' read -r key value || [ -n "$key" ]; do
      # Skip comments and empty lines
      [[ "$key" =~ ^[[:space:]]*# ]] && continue
      [[ -z "$key" ]] && continue

      # Strip surrounding quotes from value
      value="${value%\"}"
      value="${value#\"}"

      npx dotenvx set "$key" "$value" -f "$PREVIEW_FILE"
    done < "$SRC"
  fi
done

echo "✓ Done. $PREVIEW_FILE is updated and encrypted."
