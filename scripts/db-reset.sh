#!/bin/bash
set -e

# Run Supabase commands from packages/db (where supabase/ lives).
DB_DIR="packages/db"
COMMON_SEED="$DB_DIR/supabase/seed.sql"

echo "→ Resetting database..."

# Determine which personal seed to load
if [ -n "$SEED" ]; then
  # Explicit override: SEED=teammate pnpm db:reset
  SEED_NAME="$SEED"
else
  # Default: last commit author (useful when reviewing branches)
  SEED_NAME=$(git log -1 --pretty=format:'%an' | tr '[:upper:]' '[:lower:]')
fi

PERSONAL_SEED="$DB_DIR/supabase/seeds/${SEED_NAME}.sql"

# Always reset without auto seed; we load seeds manually via psql so it understands
# pg_dump 17+ meta-commands (\restrict, \unrestrict, \copy, ...) that the supabase
# CLI cannot parse over the SQL protocol.
( cd "$DB_DIR" && supabase db reset --no-seed )

DB_CONTAINER=$(docker ps --filter "name=supabase_db_" --format "{{.Names}}" | head -1)

if [ -z "$DB_CONTAINER" ]; then
  echo "✗ Supabase container not running. Run 'pnpm db:start' first."
  exit 1
fi

# load_seed <label> <path> <fail-on-error>
load_seed() {
  local label="$1"
  local path="$2"
  local fail_on_error="$3"

  echo "→ Loading $label: $path"

  if docker exec -i "$DB_CONTAINER" \
      psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      < "$path"; then
    echo "✓ $label loaded successfully"
    return 0
  fi

  if [ "$fail_on_error" = "fatal" ]; then
    echo "✗ $label failed to load. Aborting."
    exit 1
  fi

  echo ""
  echo "⚠️  $label failed to load."
  echo "   This is usually caused by schema changes (new constraints, renamed columns, etc.)."
  echo "   Your DB is in a clean state with the latest schema, but without that test data."
  echo ""
  echo "   Options to recover:"
  echo "   1. Continue without that seed (use the app/Studio to create new test data)."
  echo "   2. Reset the seed entirely:"
  echo "      rm $path"
  echo "      pnpm db:reset"
  echo "      # then create your test data and run pnpm db:dump --commit"
  echo ""
  return 1
}

# Load the personal seed if it exists (matched on $SEED override or last commit author),
# otherwise fall back to the common committed seed. Never both — they overlap by design.
if [ -f "$PERSONAL_SEED" ] && [ -s "$PERSONAL_SEED" ]; then
  load_seed "personal seed (${SEED_NAME})" "$PERSONAL_SEED" soft
elif [ -f "$COMMON_SEED" ] && [ -s "$COMMON_SEED" ]; then
  load_seed "common seed (seed.sql)" "$COMMON_SEED" fatal
fi

echo ""
echo "✓ Done"
