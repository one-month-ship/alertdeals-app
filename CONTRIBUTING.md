# Contributing Guide — AlertDeals

Welcome! This document describes the development workflow and conventions for contributing to the AlertDeals monorepo.

## Repo layout

This is a **pnpm + Turborepo monorepo**:

```
alertdeals-code/
├── apps/
│   ├── web/           # Next.js app (@alertdeals/web)
│   └── worker/        # BullMQ worker (@alertdeals/worker)
├── packages/
│   ├── db/            # Drizzle schema + client (@alertdeals/db)
│   └── shared/        # Shared types & utils (@alertdeals/shared)
├── supabase/          # Supabase config, migrations, seeds
├── scripts/           # DB & secrets shell scripts
├── .env*              # Centralized env config (see below)
└── package.json       # Root scripts (db:*, dev, build, ...)
```

All `db:*` and `dev*` commands are run from the **repo root** with `pnpm`.

## Env files — single source of truth

**All env files live at the repo root.** No `.env` inside `apps/*`, `packages/*`, or `supabase/`. Why: zero duplication, easy to audit, and matches how Vercel/Railway/etc. inject env at the project level in production.

### What's committed

| File | Purpose |
|---|---|
| `.env` | Public defaults shared across the monorepo (ports, public Supabase URL, Stripe publishable key, Resend `from` address, etc.) |
| `.env.example` | Template for `.env.local` |
| `.env.[NODE_ENV].example` | Template for `.env.development.local` / `.env.staging.local` / `.env.production.local` |
| `supabase/.env.preview` | Encrypted secrets for Supabase preview branches (managed by `pnpm secrets:encrypt`) |

### What's gitignored (personal)

| File | Purpose |
|---|---|
| `.env.local` | Personal cross-environment secrets (loaded for every NODE_ENV). E.g. your Resend API key. |
| `.env.development.local` | NODE_ENV=development secrets — your local DB URL, dev Stripe test keys, etc. |
| `.env.production.local` | NODE_ENV=production secrets. **Personal archive only** (apps in prod read from Vercel env vars). |
| `supabase/.env.keys` | Private decryption keys for `.env.preview`. |

> **Why archive `.env.production.local`?** You don't run apps locally with it — Vercel injects them. But keeping a personal copy means you can recover any secret without hunting through every provider dashboard.

### How env vars get loaded

Every script that runs anything (Next, worker, drizzle, supabase CLI) is wrapped at the **root level** with `dotenvx run`, which loads, in order:

1. `.env`
2. `.env.{development|production}` (committed defaults per environment)
3. `.env.local`
4. `.env.{development|production}.local`

The wrapped child process sees all merged vars in `process.env`. **Apps' own `package.json` scripts (`next dev`, `tsc`, etc.) stay simple — they don't touch dotenvx, they just consume `process.env`.**

So:

- `pnpm dev:web` → loads dev env, then `next dev` reads from `process.env`.
- `pnpm db:push` → loads dev env, then `drizzle-kit push` reads `SUPABASE_DATABASE_URL`.
- `pnpm build` → loads prod env, then `turbo run build`.

If you want to pass extra ad-hoc vars: `FOO=bar pnpm dev:web` (shell wins over dotenvx in the merge).

## Initial Setup (one-time)

### Prerequisites

- **Node.js** 20.11+
- **pnpm** 9+ (`npm install -g pnpm`)
- **Docker Desktop** ([docker.com](https://www.docker.com/products/docker-desktop)) — for local Supabase
- **Supabase CLI**: `brew install supabase/tap/supabase` (Mac) or see [docs.supabase.com](https://supabase.com/docs/guides/cli/getting-started)
- **GitHub CLI** (optional but handy): `brew install gh`

### Steps

1. **Set your Git username in lowercase** if not yet set (used for the personal seed system):

   ```bash
   git config --global user.name
   git config --global user.name "your-firstname"
   git config --global user.email "you@email.com"
   ```

2. **Clone the repo**:

   ```bash
   git clone https://github.com/<owner>/alertdeals.git
   cd alertdeals-code
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   ```

4. **Create your local env files**:

   ```bash
   cp .env.example .env.local
   cp .env.[NODE_ENV].example .env.development.local
   ```

   Ask a teammate for the values. Optionally also seed `.env.production.local` as a personal archive.

5. **Start Docker Desktop** (leave it running in the background).

6. **Start local Supabase**:

   ```bash
   pnpm db:start
   ```

   First time, it takes 2-5 minutes (downloading Docker images).

7. **Initialize your local database**:

   ```bash
   pnpm db:reset
   ```

8. **Run the apps**:

   ```bash
   pnpm dev              # all apps in parallel via Turbo
   # or just one:
   pnpm dev:web
   pnpm dev:worker
   ```

   Visit [http://localhost:3000](http://localhost:3000) — the web app should work.

### Verify everything works

- Web app accessible at [http://localhost:3000](http://localhost:3000)
- Supabase Studio at [http://localhost:54323](http://localhost:54323)

---

## Daily Workflow

### Start your day

```bash
git checkout main
git pull
pnpm db:start    # if Docker isn't already running
```

### Start a new feature

Always branch from an up-to-date `main`:

```bash
git checkout main
git pull
git checkout -b feat/feature-name
pnpm db:reset    # fresh DB with your personal seed
```

### Branch naming convention

- `feat/xxx`: new feature
- `fix/xxx`: bug fix
- `hotfix/xxx`: bug fix direct in prod. Should always be avoided unless asked by the owner.
- `chore/xxx`: refactor, infra, dependencies
- `docs/xxx`: documentation

### Modify the database schema

The schema lives in `packages/db/src/schema/`. Migrations are generated into `supabase/migrations/` (so the Supabase CLI can apply them locally and to remote projects).

1. Edit a schema file in `packages/db/src/schema/*.schema.ts`
2. Iterate quickly (without creating a migration):

   ```bash
   pnpm db:push
   ```

3. When satisfied, generate the migration:

   ```bash
   pnpm db:generate
   ```

4. Verify the migration applies cleanly:

   ```bash
   pnpm db:reset
   ```

5. Commit the migration and the schema together.

### Save your test data

```bash
pnpm db:dump            # writes supabase/seeds/<your-firstname>.sql
pnpm db:dump --commit   # also commits it
```

This file is versioned but personal. Other developers don't load it by default.

### Test a teammate's branch

```bash
git fetch
git checkout feat/their-branch
pnpm db:reset    # auto-loads their seed (based on last commit author)
pnpm dev
```

To force a specific seed: `SEED=teammate pnpm db:reset`.

### Finish a feature

1. Push: `git push origin feat/my-feature`
2. Open a PR to `main` on GitHub
3. Vercel creates a preview deployment, Supabase creates a DB branch
4. On merge, the Supabase-Vercel integration applies migrations to production

---

## Environments

### Production (`main`, `alertdeals.fr`)
Live site. Migrations applied automatically on merge.

### Preview (PR branches)
Vercel auto-deploys + isolated Supabase DB branch.

### Local (Docker)
Your machine, isolated. Resettable with `pnpm db:reset`.

---

## Conventions

### No direct push to `main`

Always go through a PR.

---

## Useful Commands

| Command | Description |
|---|---|
| `pnpm dev` | All apps locally (Turbo) |
| `pnpm dev:web` | Only the Next.js web app |
| `pnpm dev:worker` | Only the worker |
| `pnpm build` | Production build of every app |
| `pnpm db:start` | Start local Supabase (Docker) |
| `pnpm db:stop` | Stop local Supabase |
| `pnpm db:studio` | Open local Studio in browser |
| `pnpm db:reset` | Reset DB + apply migrations + your personal seed |
| `pnpm db:push` | Apply schema directly to local DB (fast dev iteration) |
| `pnpm db:generate` | Generate a migration file from the schema |
| `pnpm db:dump` | Save your data to your personal seed |
| `pnpm db:dump --commit` | Save your data and auto-commit |
| `pnpm db:refresh-seed` | Drop your personal seed, reset with the common seed |
| `pnpm db:push:prod` | Push migrations to the prod Supabase project |
| `pnpm secrets:encrypt` | Encrypt local secrets into `supabase/.env.preview` |

---

## Troubleshooting

### `pnpm db:reset` fails

Make sure Docker Desktop is running and `pnpm db:start` was launched.

```bash
pnpm db:stop && pnpm db:start && pnpm db:reset
```

### My personal seed fails to load after a pull

Migrations evolved and your old seed data is no longer compatible. Three options:

1. **Continue without seed** — DB has the latest schema, no test data.
2. **Refresh from clean**:

   ```bash
   rm supabase/seeds/[your-firstname].sql
   pnpm db:reset
   pnpm db:dump
   ```

3. **Manually fix the seed** — edit `supabase/seeds/[your-firstname].sql` (rare).

### Drizzle migration Git conflict

If you have a conflict on `supabase/migrations/*.sql` after `git pull`:

1. Announce on Slack / your channel that no one should touch the schema
2. Backup your custom (non-generated) migration files somewhere
3. `git checkout origin/main -- supabase/migrations/`
4. `pnpm db:generate` to regenerate from your current schema
5. `pnpm db:reset` to verify

### `pnpm db:push` says "only works on local DB"

Your `SUPABASE_DATABASE_URL` is not pointing at `127.0.0.1`. Check `.env.development.local` — production pushes go through `pnpm db:push:prod` (which uses the Supabase CLI link, not drizzle-kit).

### Vercel preview doesn't point to the right DB

- Check a DB branch exists in the Supabase dashboard
- Ensure the PR is open on GitHub
- If still broken, close & reopen the PR to force the integration to resync

---

## Useful Links

- [Supabase prod dashboard](https://supabase.com/dashboard/project/<PROD_ID>)
- [Vercel dashboard](https://vercel.com/<org>/alertdeals)
- [Supabase docs](https://supabase.com/docs)
- [Drizzle docs](https://orm.drizzle.team)
- [Next.js docs](https://nextjs.org/docs)
- [Turborepo docs](https://turbo.build/repo/docs)
- [dotenvx docs](https://dotenvx.com)
