# Contributing Guide — ActuariesConnect

Welcome! This document describes the development workflow and conventions for contributing to the project.

## Initial Setup (one-time)

### Prerequisites

Install on your machine:

- **Node.js** 20+
- **Yarn** (`npm install -g yarn`)
- **Docker Desktop** ([docker.com](https://www.docker.com/products/docker-desktop)) — for local Supabase
- **Supabase CLI**: `brew install supabase/tap/supabase` (Mac) or see [docs.supabase.com](https://supabase.com/docs/guides/cli/getting-started)
- **GitHub CLI** (optional but handy): `brew install gh`

### Configuration

1. **Set your Git username in lowercase** if not yet set (used for the personal seed system):
This is important as it will be used to seed the database with your own test data.

To check your current username: 
```bash
   git config --global user.name 
```

To set a new username and email: 
```bash
   git config --global user.name "your-firstname"
   git config --global user.email "you@email.com"
```

2. **Clone the repo**:

```bash
   git clone https://github.com/<owner>/actuariesconnect.git
   cd actuariesconnect
```

3. **Install dependencies**:

```bash
   yarn install
```

4. **Create your local env file**:

```bash
   cp .env.example .env.local
```

   Ask a team member for the values to put in `.env.local`.

5. **Start Docker Desktop** (leave it running in the background).

6. **Start local Supabase**:

```bash
   yarn db:start
```

   First time, it takes 2-5 minutes (downloading Docker images).

7. **Initialize your local database**:

```bash
   yarn db:reset
```

8. **Run the app**:

```bash
   yarn dev
```

   Visit [http://localhost:3000](http://localhost:3000) — the app should work.
The port might differ if 3000 is already in use. 

### Verify everything works

- App accessible at [http://localhost:3000](http://localhost:3000)
- Supabase Studio at [http://localhost:54323](http://localhost:54323)

If yes, your setup is good. You can start coding.

---

## Daily Workflow

### Start your day

```bash
git checkout main
git pull
yarn db:start    # if Docker isn't already running
```

### Start a new feature

Always branch from an up-to-date `main`:

```bash
git checkout main
git pull
git checkout -b feat/feature-name
yarn db:reset    # fresh DB with your personal seed
```

### Branch naming convention

- `feat/xxx`: new feature
- `fix/xxx`: bug fix
- `hotfix/xxx`: bug fix direct in prod. Should be always avoided unless asked by the owner.
- `chore/xxx`: refactor, infra, dependencies
- `docs/xxx`: documentation

### During development

#### Modify the database schema

1. Edit `src/db/schema.ts`
2. To iterate quickly (without creating a migration):
```bash
   yarn db:push
```
3. When satisfied with the final schema, generate the migration:
```bash
   yarn db:generate
```
4. Verify the migration applies cleanly:
```bash
   yarn db:reset
```
5. Commit the migration and the schema together.

### Save your test data

When you've created useful test data, save it to your personal seed file:

```bash
yarn db:dump
```

This dumps your local DB into `supabase/seeds/[your-firstname].sql`. You then need to commit it manually:

```bash
git add supabase/seeds/[your-firstname].sql
git commit -m "update my seed"
```

To dump and commit in one step, use the `--commit` flag:

```bash
yarn db:dump --commit
```

This file is versioned but personal to you. Other developers don't load it by default.

### Test a teammate's branch

```bash
git fetch
git checkout feat/their-branch
yarn db:reset    # automatically loads their seed
yarn dev
```

The system detects which seed to load based on the last commit author. To force a specific seed:

```bash
SEED=teammate yarn db:reset
```

### Finish a feature

1. Push your branch:
```bash
   git push origin feat/my-feature
```

2. Open a **Pull Request to `main`** on GitHub.

3. Vercel automatically creates a preview deployment. Supabase creates a dedicated DB branch.

4. On merge, the Supabase-Vercel integration automatically applies the migrations to production.

---

## Understanding Environments

### Production (`main` Git branch, `actuariesconnect.com`)

- Live site for real users
- Never push directly, always via PR
- Migrations propagated automatically on merge

### Staging (`staging` Git branch, `staging.actuariesconnect.com`)

- Used for client demos
- Persistent demo data
- Manually updated on demand (before a demo)

### Preview (other Git branches)

- Auto-generated URL by Vercel for each PR
- Isolated Supabase DB per PR (branching)
- Allows testing a PR without local setup

### Local (Docker)

- Your machine, fully isolated
- For fast iteration
- Resettable on demand with `yarn db:reset`

---

## Conventions

### No direct push to `main`

Never ever push directly to `main`, even for hotfix. Always go through a PR.

---

## Useful Commands

| Command | Description |
|---|---|
| `yarn dev` | Start Next.js app locally |
| `yarn db:start` | Start local Supabase (Docker) |
| `yarn db:stop` | Stop local Supabase |
| `yarn db:studio` | Open local Studio in browser |
| `yarn db:reset` | Reset DB + apply migrations + your personal seed |
| `yarn db:push` | Apply schema directly to local DB (fast dev iteration) |
| `yarn db:generate` | Generate a migration file from the schema |
| `yarn db:dump` | Save your data to your personal seed |
| `yarn db:dump --commit` | Save your data and auto-commit |

---

## Troubleshooting

### `yarn db:reset` fails

Make sure Docker Desktop is running and `yarn db:start` was launched. If the problem persists:

```bash
yarn db:stop
yarn db:start
yarn db:reset
```

### My personal seed fails to load after a pull

This can happen when migrations evolved (new constraints, renamed columns, etc.) and your old seed data is no longer compatible.

**Don't panic, the personal seed is optional**. You have three options:

1. **Continue without seed** — your DB has the latest schema but no test data. Create new data via the app or Studio as needed.

2. **Refresh your seed from a clean state** — empty your seed and rebuild:
```bash
   rm supabase/seeds/[your-firstname].sql
   yarn db:reset           # DB is now empty with the latest schema
   # Recreate your test data via the app or Studio
   yarn db:dump            # save your new seed
```

3. **Manually fix the seed** — if you have time, edit `supabase/seeds/[your-firstname].sql` to match the new schema (rare, usually not worth it).

### Drizzle migration Git conflict

If you have a conflict on files in `supabase/migrations/*.sql` or `meta/_journal.json` after `git pull`:

1. Announce to your teammates to make sure no one else is touching the schema
2. copy/paste your custom migration files (the ones not generated from the schemas) somewhere
2. Keep the `main` version:
```bash
   git checkout origin/main -- supabase/migrations/
```
This will remove your migrations files not in the last main commit, but your schema will still be there. 
3. Regenerate the migration files from your current schema:
```bash
   yarn db:generate
```
4. Test:
```bash
   yarn db:reset
```

### Vercel preview doesn't point to the right DB

This can happen if the Supabase-Vercel integration didn't sync. Check:
- A DB branch exists on the Supabase dashboard
- The PR is actually open on GitHub (not just a branch push)

If the problem persists, close and reopen the PR to force a resync.

---

## Useful Links

- [Supabase prod dashboard](https://supabase.com/dashboard/project/<PROD_ID>)
- [Supabase staging dashboard](https://supabase.com/dashboard/project/<STAGING_ID>)
- [Vercel dashboard](https://vercel.com/<org>/actuariesconnect)
- [Supabase docs](https://supabase.com/docs)
- [Drizzle docs](https://orm.drizzle.team)
- [Next.js docs](https://nextjs.org/docs)
