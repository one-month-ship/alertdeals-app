#!/bin/bash
set -e

# Determine the dev's name from Git config
SEED_NAME=$(git config user.name | tr '[:upper:]' '[:lower:]')
SEED_FILE="packages/db/supabase/seeds/${SEED_NAME}.sql"

echo "→ Dumping local data to $SEED_FILE..."
supabase --workdir packages/db db dump --data-only --local -f "$SEED_FILE"

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
