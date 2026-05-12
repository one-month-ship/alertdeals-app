#!/bin/bash
set -e

# Determine the dev's name from Git config
SEED_NAME=$(git config user.name | tr '[:upper:]' '[:lower:]')
RELATIVE_PATH="supabase/seeds/${SEED_NAME}.sql"
SEED_FILE="packages/db/${RELATIVE_PATH}"

mkdir -p "$(dirname "$SEED_FILE")"

echo "→ Dumping local data to $SEED_FILE..."
# Run from inside packages/db so supabase CLI resolves -f relative to its own workdir.
( cd packages/db && supabase db dump --data-only --local -f "$RELATIVE_PATH" )

# Strip auth tables that contain secrets or transient state:
#   - flow_state         → OAuth provider tokens captured mid-flow (blocked by GitHub Push Protection)
#   - sessions           → per-device tokens, expire fast, not portable
#   - refresh_tokens     → idem
echo "→ Stripping ephemeral auth tables..."
awk '
  /^-- Data for Name: (flow_state|sessions|refresh_tokens);/ { skip = 1; next }
  /^-- Data for Name: / { skip = 0 }
  !skip
' "$SEED_FILE" > "${SEED_FILE}.tmp" && mv "${SEED_FILE}.tmp" "$SEED_FILE"

# Auto-commit if --commit flag is passed
if [ "$1" == "--commit" ]; then
  git add "$SEED_FILE"
  git commit -m "update my seed"
  echo "✓ Committed"
else
  echo "✓ Done. Don't forget to commit:"
  echo "  git add $SEED_FILE"
  echo "  git commit -m \"update my seed\""
fi
