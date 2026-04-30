#!/bin/bash
set -e

SEED_NAME=$(git config user.name | tr '[:upper:]' '[:lower:]')
PERSONAL_SEED="packages/db/supabase/seeds/${SEED_NAME}.sql"

echo "→ This will reset your DB with the latest common seed."
echo "  Your old personal seed will be removed (you'll need to re-dump after adding test data)."
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

# 1. Remove current personal seed
echo "→ Removing personal seed: $PERSONAL_SEED"
rm -f "$PERSONAL_SEED"

# 2. Reset db with common seed
echo "→ Resetting with common seed..."
supabase --workdir packages/db db reset

echo ""
echo "✓ Done. Your DB is now populated with the latest common seed."
echo "  Add your test data via the Studio, then run 'pnpm db:dump' to save it."
