# MEMORY — Cronjobs Project

## Project
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Turbopack
Cron Job Scheduler — web UI to filter cron jobs by date/time range.

## PostgreSQL
- Docker container: `postgres-db` (postgres:17)
- Host: `localhost:5432`
- Database: `cronjobs`
- User: `postgres` (no password)
- Table: `cron_jobs` with columns: `id`, `name`, `schedule`, `description`, `days`, `hours`, `minutes`, `months`, `weeks`, `years`, `enabled`, `compositeServiceName`, `created_at`, `updated_at`
- 15 seeded jobs, synced with `cron_jobs.json`

## Architecture
```
src/app/
  page.tsx          # Client component, hardcoded jobs (line 9)
  layout.tsx        # Geist fonts, metadata
  globals.css       # Tailwind v4
  lib/
    cron.ts         # Custom local-time cron evaluator (no cron-parser)
cron_jobs.json      # Source of truth for job data
```

## Gotchas
- **No cron-parser** — custom evaluator in `lib/cron.ts` handles local time. cron-parser defaults to UTC → wrong results.
- **Jobs hardcoded** in `page.tsx:9` — not loaded from JSON. Update both when changing jobs.
- **`cronMatches()` uses OR** for day-of-month + day-of-week (traditional cron semantics).
- **Composite keys** in JSX: `key={`${job.name}-${i}`}` to avoid duplicate key warnings.
- **Port 3001** — 3000 may be in use.
- **Heredoc psql fails** — use `docker cp` + `-f` flag for SQL files.

## Commands
```
npm run dev     # dev on port 3001
npm run build   # production build
npm run lint    # ESLint
```

## Key Decisions
- Replaced `cron-parser` with custom local-time evaluator due to UTC bug.
- Jobs stored in `cron_jobs.json` and PostgreSQL, but app reads hardcoded array (sync manually).
- `compositeServiceName` groups jobs by service domain (observability, analytics, security, etc.).
