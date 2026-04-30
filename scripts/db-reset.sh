#!/bin/bash
set -e

echo "→ Resetting database..."

# Determine which seed to load
if [ -n "$SEED" ]; then
  # Explicit override: SEED=oualid pnpm db:reset
  SEED_NAME="$SEED"
else
  # Default: last commit author (useful when reviewing branches)
  SEED_NAME=$(git log -1 --pretty=format:'%an' | tr '[:upper:]' '[:lower:]')
fi

PERSONAL_SEED="packages/db/supabase/seeds/${SEED_NAME}.sql"

if [ -f "$PERSONAL_SEED" ] && [ -s "$PERSONAL_SEED" ]; then
  # Reset without auto seed (we'll load the personal seed manually)
  supabase --workdir packages/db db reset --no-seed

  # Find the Supabase Postgres container dynamically
  DB_CONTAINER=$(docker ps --filter "name=supabase_db_" --format "{{.Names}}" | head -1)

  if [ -z "$DB_CONTAINER" ]; then
    echo "✗ Supabase container not running. Run 'pnpm db:start' first."
    exit 1
  fi

  echo "→ Loading personal seed: $PERSONAL_SEED"

  # Try to load the personal seed, but don't fail if it errors
  if docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$PERSONAL_SEED"; then
    echo "✓ Personal seed loaded successfully"
  else
    echo ""
    echo "⚠️  Your personal seed failed to load."
    echo "   This is usually caused by schema changes (new constraints, renamed columns, etc.)."
    echo "   Your DB is in a clean state with the latest schema, but without your test data."
    echo ""
    echo "   Options to recover:"
    echo "   1. Continue without seed (use the app/Studio to create new test data)"
    echo "   2. Reset your seed entirely:"
    echo "      rm packages/db/supabase/seeds/${SEED_NAME}.sql"
    echo "      pnpm db:reset"
    echo "      # then create your test data and run pnpm db:dump --commit"
    echo ""
  fi
else
  # No personal seed: use the common seed.sql via standard reset
  supabase --workdir packages/db db reset
fi

echo ""
echo "✓ Done"
