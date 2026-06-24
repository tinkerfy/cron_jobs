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
     route.ts        # GET — fetches enabled jobs from MySQL, server-side cron matching
   lib/
     cron.ts         # Custom local-time cron evaluator, date formatting, MatchedJob types
     db.ts           # mysql2 connection pool
```

## MySQL
- Host: `localhost:3306` · Database: `cronjobs` · User: `root` · Password: `postgress` (in `db.ts`)
- Docker: `docker compose up -d` to start
- Table: `cron_jobs` — columns: `id`, `name`, `minutes`, `hours`, `days`, `months`, `weeks`, `years`, `description`, `enabled`, `server`, `compositeservicename`, `created_at`, `updated_at`
- Only enabled jobs are returned by the API.

## Gotchas
- **cron-parser is installed but unused** — the app uses its own evaluator in `lib/cron.ts`. Do not replace it with `cron-parser` (defaults to UTC → wrong results).
- **`cronMatches()` in `lib/cron.ts:37`** uses traditional cron semantics: when both day-of-month and day-of-week are constrained, it uses OR logic.
- **Composite keys** for matched date items: `key={`${job.name}-${i}`}` to avoid duplicate key warnings.
- **`cron-parser` in `package.json`** — leave it for now; the custom evaluator works correctly for local time.

## Filtering changes require validation

Any change to filtering logic **must** be validated by the `filtering-validator` agent before being considered complete:

```
filtering-validator
```

This covers:
- New filter parameters in the API (`route.ts`)
- New filter UI components (`page.tsx`)
- Changes to `cronMatches()`, `parseField()`, `expandCron()`, `matchJobs()`
- Changes to `generateScheduleDescription()`
- Any new filtering feature or requirement

The agent runs 108 tests in `src/app/lib/cron.test.ts`. All tests must pass.
