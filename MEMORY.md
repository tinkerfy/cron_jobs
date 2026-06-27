# MEMORY — Cronjobs Project

## Project
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Turbopack
Cron Job Scheduler — web UI to filter cron jobs by date/time range.

## MySQL
- Docker container: `cronjobs-mysql` (mysql:8.0)
- Host: `localhost:3306`
- Database: `cronjobs`
- User: `root` · Password: `postgress` (in `db.ts`)
- Table: `cron_jobs` with columns: `id`, `minutes`, `hours`, `days`, `months`, `weeks`, `years`, `status` (VARCHAR 'true'/'false'), `scheduler` (VARCHAR 'true'/'false' or NULL), `server`, `compositeservicename`, `description`, `created_at`, `updated_at`
- **`name` column removed** — use `compositeservicename` for all identification
- **`status`** is VARCHAR (`'true'`/`'false'`), not BOOLEAN — app converts to boolean
- **`scheduler`** is VARCHAR (`'true'`/`'false'`/NULL), not BOOLEAN — app converts to boolean

## Architecture
```
src/app/
  page.tsx          # Client component — fetches jobs from /api/cron-jobs on mount
  layout.tsx        # Geist fonts, metadata
  globals.css       # Tailwind v4 via @import
  api/cron-jobs/
     route.ts        # GET — fetches enabled jobs from MySQL, server-side cron matching
   lib/
     cron.ts         # Custom local-time cron evaluator, date formatting
     cron.test.ts    # 108 tests for cron evaluator
     db.ts           # mysql2 connection pool
     types.ts        # CronJob, CronJobRow, MatchedJob interfaces
```

## Gotchas
- **No cron-parser** — custom evaluator in `lib/cron.ts` handles local time. cron-parser defaults to UTC → wrong results.
- **`status`/`scheduler` are VARCHAR** — DB values are `'true'`/`'false'` strings, app converts to boolean. API queries use string values directly.
- **`cronMatches()` uses OR** for day-of-month + day-of-week (traditional cron semantics).
- **Composite keys** in JSX: `key={`${job.compositeServiceName}-${i}`}` to avoid duplicate key warnings.
- **API query param for status filter is `status`**, not `enabled`.
- **Sort by "Name" sorts by `compositeServiceName`** since `name` column was dropped.
- **`CronJobRow.status` and `CronJobRow.scheduler` are `string`**, not `boolean`.

## Commands
```
npm run dev     # dev on port 3000
npm run build   # production build
npm run lint    # ESLint
```

## Key Decisions
- Replaced `cron-parser` with custom local-time evaluator due to UTC bug.
- Jobs loaded from MySQL via `/api/cron-jobs` endpoint.
- `compositeServiceName` groups jobs by service domain (observability, analytics, security, etc.).
- `status` and `scheduler` stored as VARCHAR strings ('true'/'false') in DB.
- `name` column removed from DB — all identification uses `compositeServiceName`.

## Recent Changes
- **Removed `name` column** from DB and all code references.
- **`status`/`scheduler` changed from TINYINT to VARCHAR** with `'true'`/`'false'` values.
- **Added error banner** (red, dismissable) for fetch failures.
- **Added sort dropdown** (Name, Next Run, Execution Count, Server, Service).
- **Removed from plan**: 2A (Name Search), 2B (Year Filter), 2C (Next Run), 2D (Filter Summary), 3C (Copy Cron), 3D (Export), 3E (Overlap), 4A (Frequency), 4B (Grouping), 4C (Timezone Selector).
