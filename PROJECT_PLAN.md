# Cron Job Monitor — Phased Project Plan

---

## Phase 0: Critical Bug Fix

### 0A — Timezone Bug Fix ✅
**Why first:** All cron matching is currently off by the user's timezone offset. No new feature is trustworthy until this is fixed.

| Task | Details | Files | Status |
|---|---|---|---|
| Fix `buildDateTime()` / `fmt()` serialization | Append timezone offset (e.g. `+05:30`) so the server interprets times correctly | `lib/cron.ts` | ✅ Done |
| Update `fetchResults()` date parsing | Ensure `new Date()` on the client doesn't misinterpret strings | `page.tsx` | ✅ Done |
| Validate `from <= to` | Reject inverted or absurdly large date ranges before API call | `page.tsx` | ✅ Done |
| Run 108 cron tests | Confirm no regressions | `lib/cron.test.ts` | ✅ Done |

**Estimated effort:** 1–2 hours

---

## Phase 1: Data Integrity & Correctness

### 1A — Unify CronJob Interface ✅
**Why:** Duplicate `CronJob` types in `cron.ts` and `route.ts` can drift apart silently.

| Task | Details | Files | Status |
|---|---|---|---|
| Move `CronJob` to a shared types file | Export from `cron.ts`, import in `route.ts` | `lib/cron.ts`, `app/api/cron-jobs/route.ts` | ✅ Done |
| Add shared row type for DB results | Replace `as unknown as [...]` casts with a typed interface | `lib/db.ts`, `route.ts` | ✅ Done |
| Run linter + tests | Confirm no breakage | — | ✅ Done |

**Estimated effort:** 30 min

### 1B — Fix Dual `status` / `enabled` Confusion ✅
**Why:** The DB has both `status` (string "true"/"false") and `enabled` (boolean). The API reads `status` but the schema has `enabled`. Unclear which is canonical.

| Task | Details | Files | Status |
|---|---|---|---|
| Audit usage of `status` vs `enabled` | Determine which column should be the source of truth | `route.ts`, `db.ts`, schema | ✅ Done |
| Align API to use the correct column | Update query and response accordingly | `route.ts` | ✅ Done |
| Update UI filter labels if needed | "Enabled/Disabled" may need renaming | `page.tsx` | ✅ Done |
| Rename DB column `enabled` → `status` | ALTER TABLE + update values to 'true'/'false' | DB | ✅ Done |
| Rename DB column `scheduler` → VARCHAR | ALTER TABLE + update values to 'true'/'false' | DB | ✅ Done |
| Update all types/interfaces | `CronJob`, `CronJobRow`, test fixtures | `types.ts`, `cron.test.ts` | ✅ Done |
| Update API query params | `enabled` → `status` in URL params | `route.ts`, `page.tsx` | ✅ Done |
| Update UI comparisons | `job.status` string comparisons | `page.tsx` | ✅ Done |

**Estimated effort:** 30 min – 1 hr

---

## Phase 2: Core Feature Additions

---

## Phase 3: UX & Quality of Life

### 3A — Error Feedback (Toast/Banner) ✅
**Why:** All errors currently go to `console.error` only. Users have no visual feedback when fetch fails.

| Task | Details | Files | Status |
|---|---|---|---|
| Create error banner component | Inline, dismissable, color-coded (red) at top | `page.tsx` | ✅ Done |
| Wire up fetch error states | `setError()` in both fetch paths | `page.tsx` | ✅ Done |

**Estimated effort:** 30 min

### 3B — Sort Options ✅
**Why:** Jobs are always alphabetical. Users may want to sort by next run, execution count, server, or service.

| Task | Details | Files | Status |
|---|---|---|---|
| Add sort dropdown | Options: Name, Next Run, Execution Count, Server, Service | `page.tsx` | ✅ Done |
| Implement sort logic | Client-side sort on fetched results | `page.tsx` | ✅ Done |
| Add click-outside to close | mousedown listener on document | `page.tsx` | ✅ Done |

**Estimated effort:** 1 hr

### 1C — Remove `name` Column, Route to `compositeServiceName` ✅
**Why:** `name` is redundant — every job has a `compositeServiceName`. The DB column was dropped and all references updated.

| Task | Details | Files | Status |
|---|---|---|---|
| Drop `name` column from DB | `ALTER TABLE cron_jobs DROP COLUMN name` | DB | ✅ Done |
| Remove `name` from `CronJob` interface | Update `types.ts` | `types.ts` | ✅ Done |
| Remove `name` from `CronJobRow` interface | Update DB row type | `types.ts` | ✅ Done |
| Update API query | Remove `name` from SELECT, ORDER BY by `compositeservicename` | `route.ts` | ✅ Done |
| Update job mapping | Remove `name: row.name` from object spread | `route.ts` | ✅ Done |
| Update UI key props | Use `compositeServiceName` for all `key` attributes | `page.tsx` | ✅ Done |
| Update sort logic | "Name" sort now sorts by `compositeServiceName` | `page.tsx` | ✅ Done |
| Update test fixtures | Replace `name` with `compositeServiceName` | `cron.test.ts` | ✅ Done |

**Estimated effort:** 30 min

---

## Phase 5: Cleanup & Hardening

### 5A — Dead Code Removal ✅
**Why:** Reduces confusion, bundle size, and maintenance burden.

| Item | Status | Action |
|---|---|---|
| `page.tsx.backup` | Stale backup | ✅ Deleted |
| `tokens.ts` | Colors defined but never imported | ✅ Deleted |
| `ThemeInitializer` | Never rendered anywhere | ✅ Deleted (not found) |
| `providers.tsx` | Pointless wrapper around `theme-context.tsx` | ✅ Deleted |
| `cron-parser` in `package.json` | Explicitly not used (per AGENTS.md) | ✅ Removed |
| `cron_jobs.json` | Out of sync with DB, unused | ✅ Deleted |
| `MEMORY.md` | References PostgreSQL; project uses MySQL | ✅ Updated |
| `agent.sh` | PostgreSQL setup script; project uses MySQL | ✅ Deleted |
| `expandCron()`, `matchJobs()`, `getScheduleSummary()` | Exported but never called in production | Keep for tests; consider removing `export` |

**Estimated effort:** 30 min

### 5B — Security Hardening ✅
**Why:** Hardcoded DB credentials are a production risk.

| Task | Details | Files | Status |
|---|---|---|---|
| Add `.env.example` | Document required env vars (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) | New file | ✅ Done |
| Move credentials to env vars | Update `db.ts` to read from `process.env` | `lib/db.ts` | ✅ Done |
| Add `.env.local` to `.gitignore` | Prevent accidental commit | `.gitignore` | ✅ Already covered by `.env*` |

**Estimated effort:** 15 min

### 5C — Test Runner Setup ✅
**Why:** 108 tests exist but are run manually. No CI safety net.

| Task | Details | Files | Status |
|---|---|---|---|
| Add Vitest | Configure for TypeScript, no framework needed (tests are plain tsx) | `vitest.config.ts`, `package.json` scripts | ✅ Done |
| Update `cron.test.ts` if needed | Ensure it runs under Vitest | `lib/cron.test.ts` | ✅ Done (no changes needed) |
| Add `npm test` script | `vitest run` | `package.json` | ✅ Done |

**Estimated effort:** 30 min

---

## Phase 6: Export & Timezone

### 6A — Export to CSV ✅
**Why:** Users need to save and share matched job results for reporting and audit purposes.

| Task | Details | Files | Status |
|---|---|---|---|
| Add `buildCsvData()` function | CSV string builder from `MatchedJob[]` — columns: Job, Server, Status, Schedule, Description, Execution Count, Execution Dates | `page.tsx` | ✅ Done |
| Add `handleExportCsv()` handler | Blob + `<a download>` pattern, filename `cron-jobs-YYYYMMDD.csv` | `page.tsx` | ✅ Done |
| Add Export CSV button | Next to sort menu, disabled when no results, consistent styling | `page.tsx` | ✅ Done |
| Add size warning | Warn at >100k dates (browser slowdown risk) | `page.tsx` | ✅ Done |

**Complexity:** Low — one file, no new dependencies, no test changes.

### 6B — Timezone Support ⬜
**Why:** Users across countries need to view cron schedules in their local timezone, not just the browser default.

| Task | Details | Files | Status |
|---|---|---|---|
| Add timezone selector dropdown | Major IANA timezones (UTC, ET, PT, CT, GMT, CET, JST, etc.) | `page.tsx` | ⬜ |
| Default to browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` | | `page.tsx` | ⬜ |
| Add `timezone` query param to API | Thread `?timezone=` through `fetchResults` | `page.tsx`, `route.ts` | ⬜ |
| Modify `cronMatches()` for timezone | Optional `targetTimezone` param, use `Intl.DateTimeFormat` to extract hour/day/month in target TZ | `lib/cron.ts` | ⬜ |
| Thread timezone through `expandCron()` / `matchJobs()` | | `lib/cron.ts` | ⬜ |
| Update `formatDate()` / `formatTime()` | Accept optional `timeZone` param, use `Intl.DateTimeFormat` with `timeZone` | `lib/cron.ts` | ⬜ |
| Update UI to pass timezone to formatters | All date rendering in job cards | `page.tsx` | ⬜ |
| Update relative dates ("in 3h", "tomorrow") | Compute "now" in target timezone | `lib/cron.ts` | ⬜ |
| Add timezone-aware tests | DST transitions, cross-timezone scenarios | `cron.test.ts` | ⬜ |
| Run 108 cron tests | Confirm no regressions | `cron.test.ts` | ⬜ |

**Complexity:** Medium — core logic changes, test suite updates, DST edge cases.

---

## Summary Table

| Phase | Title | Tasks | Effort |
|---|---|---|---|
| **0** | Critical Bug Fix | Timezone fix, date validation | ✅ Done |
| **1** | Data Integrity | Unify types, fix status/enabled, remove name | ✅ Done |
| **2** | Core Features | (removed 2A, 2B, 2C, 2D) | — |
| **3** | UX Enhancements | Error banner ✅, Sort ✅ | 1–2 hrs done |
| **4** | Intelligence | (removed 4A, 4B, 4C) | — |
| **5** | Cleanup | Dead code removal, env vars, test runner | ✅ Done |
| **6** | Export & Timezone | CSV export ✅, Timezone ⬜ | 1–2 hrs (CSV) + 4–6 hrs (TZ) |
| | | | **~20–32 hrs total** |

---

## Review Points

Each phase ends with a checkpoint where you decide:
- ✅ **Proceed** to the next phase
- ⏸ **Pause** — review results before continuing
- ❌ **Skip** — don't implement this phase
- 🔄 **Modify** — change scope before starting
