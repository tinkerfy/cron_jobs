# AGENTS.md

## Tech stack
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · React 19

## Commands
```
npm run dev      # Dev server (port 3000)
npm run build    # Production build
npm run lint     # ESLint (uses eslint-config-next)
```

## Architecture
```
src/app/
  page.tsx          # Client component — fetches jobs from /api/cron-jobs on mount
  layout.tsx        # Geist fonts, metadata
  globals.css       # Tailwind v4 via @import
  api/cron-jobs/
    route.ts        # GET — fetches enabled jobs from PostgreSQL, server-side cron matching
  lib/
    cron.ts         # Custom local-time cron evaluator, date formatting, MatchedJob types
    db.ts           # pg connection pool
```

## PostgreSQL
- Host: `localhost:5432` · Database: `cronjobs` · User: `postgres` · Password: `postgress` (in `db.ts`)
- Table: `cron_jobs` — columns: `name`, `schedule`, `description`, `enabled`, `created_at`, `updated_at`
- Only enabled jobs are returned by the API.

## Gotchas
- **cron-parser is installed but unused** — the app uses its own evaluator in `lib/cron.ts`. Do not replace it with `cron-parser` (defaults to UTC → wrong results).
- **`cronMatches()` in `lib/cron.ts:37`** uses traditional cron semantics: when both day-of-month and day-of-week are constrained, it uses OR logic.
- **Composite keys** for matched date items: `key={`${job.name}-${i}`}` to avoid duplicate key warnings.
- **`cron-parser` in `package.json`** — leave it for now; the custom evaluator works correctly for local time.
