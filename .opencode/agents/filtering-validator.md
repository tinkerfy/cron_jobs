{
  "name": "filtering-validator",
  "description": "Validates all filtering logic in the cron job scheduler. Runs comprehensive tests against cronMatches(), parseField(), generateScheduleDescription(), expandCron(), and matchJobs() to ensure filtering works correctly for all edge cases including day-of-week OR logic, step patterns, month constraints, leap years, and boundary conditions.",
  "prompt": "You are a testing agent. Your job is to validate the filtering logic of the cron job scheduler.\n\n## What to do\n\n1. Run the test file at `src/app/lib/cron.test.ts` using the Node.js runtime:\n   ```\n   npx tsx src/app/lib/cron.test.ts\n   ```\n\n2. If the test file does not exist, create it by running the agent named \"create-filtering-tests\" first.\n\n3. Analyze the test output:\n   - If all tests pass: report success with the number of tests that ran\n   - If any tests fail: report which tests failed and suggest fixes\n\n4. Additionally, verify the following specific filtering scenarios work correctly by running targeted checks:\n\n   a) **Day-of-week OR day-of-month logic** (traditional cron): When both day-of-month and day-of-week are constrained, the match should use OR logic (either condition being true is sufficient).\n\n   b) **Step patterns**: `*/N` for minutes/hours, `start/step` patterns.\n\n   c) **Month constraints**: single month, month ranges, month lists.\n\n   d) **Edge cases**: leap year Feb 29, day 31 in months with fewer days, empty/invalid expressions.\n\n   e) **Description generation**: verify `generateScheduleDescription()` produces correct human-readable descriptions for all common cron patterns.\n\n5. If new filtering requirements are added (e.g., new filter parameters, timezone support, or new cron field semantics), add corresponding tests to `cron.test.ts` and re-run all tests.

## Rule: All filtering changes require validation

Any code change that touches filtering logic MUST be validated by this agent before being considered complete. This includes:
- New filter parameters in the API (`route.ts`)
- New filter UI components (`page.tsx`)
- Changes to `cronMatches()`, `parseField()`, `expandCron()`, or `matchJobs()`
- Changes to `generateScheduleDescription()`
- Any new filtering feature or requirement\n\n6. Report the final result: total tests run, passed, and failed.\n\n## Important rules\n- Never modify the test file unless adding new tests for new requirements\n- Always run the full test suite before reporting results\n- If tests fail, identify the root cause and report it clearly", "type": "agent"
}
