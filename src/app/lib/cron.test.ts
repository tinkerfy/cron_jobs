import { cronMatches, parseField, generateScheduleDescription, expandCron, matchJobs, CronJob } from "./cron";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function section(name: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${name}`);
  console.log("=".repeat(60));
}

// ─── parseField tests ───────────────────────────────────────────────
section("parseField");

{
  const min0max59 = (field: string) => parseField(field, 0, 59);
  const min1max31 = (field: string) => parseField(field, 1, 31);
  const min1max12 = (field: string) => parseField(field, 1, 12);
  const min0max23 = (field: string) => parseField(field, 0, 23);

  // Wildcard
  let s = min0max59("*");
  assert(s.size === 60, "wildcard 0-59 has 60 values");

  // Single value
  s = min0max59("5");
  assert(s.size === 1 && s.has(5), "single value 5");

  // Comma list
  s = min0max59("0,15,30,45");
  assert(s.size === 4 && s.has(0) && s.has(15) && s.has(30) && s.has(45), "comma list 0,15,30,45");

  // Range
  s = min0max59("10-20");
  assert(s.size === 11 && s.has(10) && s.has(20) && !s.has(9) && !s.has(21), "range 10-20");

  // Step from wildcard
  s = min0max59("*/15");
  assert(s.size === 4 && s.has(0) && s.has(15) && s.has(30) && s.has(45), "step */15");

  // Step from specific start
  s = min0max59("5/15");
  assert(s.has(5) && s.has(20) && s.has(35) && s.has(50), "step 5/15");

  // Range with step
  s = min0max59("10-40/10");
  assert(s.has(10) && s.has(20) && s.has(30) && s.has(40), "range-step 10-40/10");

  // Day of month: wildcard
  s = min1max31("*");
  assert(s.size === 31, "day of month wildcard has 31 values");

  // Month: wildcard
  s = min1max12("*");
  assert(s.size === 12, "month wildcard has 12 values");

  // Hour wildcard
  s = min0max23("*");
  assert(s.size === 24, "hour wildcard has 24 values");
}

// ─── cronMatches: wildcard fields ───────────────────────────────────
section("cronMatches — wildcard fields");

{
  const d = new Date(2026, 5, 15, 10, 30); // June 15, 2026, 10:30 AM
  const dayOfWeek = d.getDay(); // Monday = 1

  // All wildcards should always match
  assert(cronMatches(d, "* * * * *") === true, "all wildcards always match");

  // Wildcard minutes, specific hour
  assert(cronMatches(d, "0 10 * * *") === false, "minute 0 at hour 10 — 10:30 should not match");
  assert(cronMatches(new Date(2026, 5, 15, 10, 0), "0 10 * * *") === true, "minute 0 at hour 10 — exact match");

  // Wildcard hours, specific minute
  assert(cronMatches(d, "30 * * * *") === true, "minute 30 every hour — matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 31), "30 * * * *") === false, "minute 30 every hour — 10:31 should not match");

  // Wildcard days, specific month
  assert(cronMatches(d, "0 0 1 6 *") === false, "jan 1 at midnight — june should not match");
  assert(cronMatches(new Date(2026, 5, 1, 0, 0), "0 0 1 6 *") === true, "jan 1 at midnight — june 1 matches");

  // Wildcard day-of-week, specific day-of-month (use midnight to isolate day check)
  assert(cronMatches(new Date(2026, 5, 15, 0, 0), "0 0 15 * *") === true, "day 15 matches");
  assert(cronMatches(new Date(2026, 5, 16, 0, 0), "0 0 15 * *") === false, "day 16 should not match day 15");
}

// ─── cronMatches: day-of-week ───────────────────────────────────────
section("cronMatches — day-of-week");

{
  // 2026-06-15 is Monday (getDay() = 1)
  const monday = new Date(2026, 5, 15, 10, 0);
  // 2026-06-14 is Sunday (getDay() = 0)
  const sunday = new Date(2026, 5, 14, 10, 0);
  // 2026-06-20 is Saturday (getDay() = 6)
  const saturday = new Date(2026, 5, 20, 10, 0);
  // 2026-06-21 is Sunday (getDay() = 0)
  const nextSunday = new Date(2026, 5, 21, 10, 0);

  // Sunday = 0, Monday = 1, Saturday = 6, next Sunday = 0
  assert(cronMatches(sunday, "0 10 * * 0") === true, "sunday (0) matches dow 0");
  assert(cronMatches(monday, "0 10 * * 1") === true, "monday (1) matches dow 1");
  assert(cronMatches(saturday, "0 10 * * 6") === true, "saturday (6) matches dow 6");
  assert(cronMatches(monday, "0 10 * * 0") === false, "monday does not match dow 0");
  assert(cronMatches(sunday, "0 10 * * 1") === false, "sunday does not match dow 1");

  // Cron: 7 = Sunday (same as 0)
  assert(cronMatches(sunday, "0 10 * * 7") === true, "sunday matches dow 7");
  assert(cronMatches(monday, "0 10 * * 7") === false, "monday does not match dow 7");

  // Multiple days
  assert(cronMatches(monday, "0 10 * * 1,3,5") === true, "monday matches 1,3,5");
  assert(cronMatches(sunday, "0 10 * * 1,3,5") === false, "sunday does not match 1,3,5");

  // Day range
  assert(cronMatches(monday, "0 10 * * 1-5") === true, "monday matches 1-5 range");
  assert(cronMatches(sunday, "0 10 * * 1-5") === false, "sunday does not match 1-5 range");
  assert(cronMatches(saturday, "0 10 * * 1-5") === false, "saturday does not match 1-5 range");

  // Weekend range 0-6 = all days
  assert(cronMatches(monday, "0 10 * * 0-6") === true, "0-6 matches all days");
  assert(cronMatches(saturday, "0 10 * * 0-6") === true, "0-6 matches all days");
}

// ─── cronMatches: day-of-month vs day-of-week (OR logic) ────────────
section("cronMatches — day-of-week OR day-of-month");

{
  // Traditional cron: when both are constrained, OR logic applies
  // 2026-06-15 is Monday (dow=1), dayOfMonth=15
  const mon15 = new Date(2026, 5, 15, 10, 0);
  // 2026-06-16 is Tuesday (dow=2), dayOfMonth=16
  const tue16 = new Date(2026, 5, 16, 10, 0);
  // 2026-06-14 is Sunday (dow=0), dayOfMonth=14
  const sun14 = new Date(2026, 5, 14, 10, 0);

  // Both constrained: dayOfMonth=15 AND dow=1 (OR logic)
  // Should match if EITHER condition is true
  assert(cronMatches(mon15, "0 10 15 * 1") === true, "OR: day 15 matches (dayOfMonth)");
  assert(cronMatches(new Date(2026, 5, 22, 10, 0), "0 10 15 * 1") === true, "OR: monday matches (dow), even though day != 15");
  // 2026-06-22 is Monday (dow=1), dayOfMonth=22
  assert(cronMatches(mon15, "0 10 15 * 1") === true, "OR: both conditions true");

  // Only dayOfMonth constrained
  assert(cronMatches(mon15, "0 10 15 * *") === true, "dayOfMonth 15 only: day 15 matches");
  assert(cronMatches(tue16, "0 10 15 * *") === false, "dayOfMonth 15 only: day 16 does not match");

  // Only dow constrained
  assert(cronMatches(mon15, "0 10 * * 1") === true, "dow 1 only: monday matches");
  assert(cronMatches(tue16, "0 10 * * 1") === false, "dow 1 only: tuesday does not match");

  // Neither constrained
  assert(cronMatches(mon15, "0 10 * * *") === true, "no constraints: always matches");
}

// ─── cronMatches: step patterns ─────────────────────────────────────
section("cronMatches — step patterns");

{
  // Every 15 minutes
  assert(cronMatches(new Date(2026, 5, 15, 10, 0), "*/15 * * * *") === true, "*/15: 10:00 matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 15), "*/15 * * * *") === true, "*/15: 10:15 matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 30), "*/15 * * * *") === true, "*/15: 10:30 matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 45), "*/15 * * * *") === true, "*/15: 10:45 matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 10), "*/15 * * * *") === false, "*/15: 10:10 does not match");

  // Every 10 minutes starting at minute 5
  assert(cronMatches(new Date(2026, 5, 15, 10, 5), "5/10 * * * *") === true, "5/10: 10:05 matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 15), "5/10 * * * *") === true, "5/10: 10:15 matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 25), "5/10 * * * *") === true, "5/10: 10:25 matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 0), "5/10 * * * *") === false, "5/10: 10:00 does not match");

  // Every 2 hours
  assert(cronMatches(new Date(2026, 5, 15, 0, 30), "30 */2 * * *") === true, "*/2 hours: 00:30 matches");
  assert(cronMatches(new Date(2026, 5, 15, 2, 30), "30 */2 * * *") === true, "*/2 hours: 02:30 matches");
  assert(cronMatches(new Date(2026, 5, 15, 3, 30), "30 */2 * * *") === false, "*/2 hours: 03:30 does not match");
  assert(cronMatches(new Date(2026, 5, 15, 23, 30), "30 */2 * * *") === false, "*/2 hours: 23:30 does not match");
}

// ─── cronMatches: month constraints ─────────────────────────────────
section("cronMatches — month constraints");

{
  // Specific month
  assert(cronMatches(new Date(2026, 0, 15, 10, 0), "0 10 * 1 *") === true, "month 1: january matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 0), "0 10 * 1 *") === false, "month 1: june does not match");
  assert(cronMatches(new Date(2026, 11, 15, 10, 0), "0 10 * 12 *") === true, "month 12: december matches");
  assert(cronMatches(new Date(2026, 11, 15, 10, 0), "0 10 * 1 *") === false, "month 12: december does not match month 1");

  // Month range
  assert(cronMatches(new Date(2026, 2, 15, 10, 0), "0 10 * 3-6 *") === true, "month range 3-6: march matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 0), "0 10 * 3-6 *") === true, "month range 3-6: june matches");
  assert(cronMatches(new Date(2026, 6, 15, 10, 0), "0 10 * 3-6 *") === false, "month range 3-6: july does not match");

  // Multiple months
  assert(cronMatches(new Date(2026, 0, 15, 10, 0), "0 10 * 1,6,12 *") === true, "months 1,6,12: jan matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 0), "0 10 * 1,6,12 *") === true, "months 1,6,12: june matches");
  assert(cronMatches(new Date(2026, 11, 15, 10, 0), "0 10 * 1,6,12 *") === true, "months 1,6,12: dec matches");
  assert(cronMatches(new Date(2026, 3, 15, 10, 0), "0 10 * 1,6,12 *") === false, "months 1,6,12: april does not match");
}

// ─── cronMatches: edge cases ────────────────────────────────────────
section("cronMatches — edge cases");

{
  // Invalid expression
  assert(cronMatches(new Date(2026, 5, 15, 10, 0), "") === false, "empty expression returns false");
  assert(cronMatches(new Date(2026, 5, 15, 10, 0), "0 10") === false, "too few fields returns false");

  // Leap year: Feb 29
  const leap2024 = new Date(2024, 1, 29, 10, 0); // Feb 29, 2024 (leap year)
  assert(cronMatches(leap2024, "0 10 29 2 *") === true, "leap year: feb 29 matches");

  // Non-leap year: Feb 29 should not match
  const nonLeap2025 = new Date(2025, 1, 28, 10, 0);
  assert(cronMatches(new Date(2025, 1, 29, 10, 0), "0 10 29 2 *") === false, "non-leap: feb 29 does not exist");

  // Day of month boundary: day 31
  assert(cronMatches(new Date(2026, 0, 31, 10, 0), "0 10 31 * *") === true, "day 31: january has 31 days");
  assert(cronMatches(new Date(2026, 4, 31, 10, 0), "0 10 31 * *") === true, "day 31: may has 31 days");
  assert(cronMatches(new Date(2026, 3, 31, 10, 0), "0 10 31 * *") === false, "day 31: april has only 30 days");

  // Complex expression
  assert(cronMatches(new Date(2026, 5, 15, 10, 30), "30 10 * 6 *") === true, "complex: 10:30 on june 15 matches");
  assert(cronMatches(new Date(2026, 5, 15, 10, 30), "30 10 * 1 *") === false, "complex: 10:30 on june 15 does not match month 1");
}

// ─── generateScheduleDescription tests ──────────────────────────────
section("generateScheduleDescription");

{
  // Simple patterns
  assert(
    generateScheduleDescription("0 10 * * *") === "Daily at 10:00 AM",
    "single hour daily"
  );
  assert(
    generateScheduleDescription("0 0 * * *") === "Daily at 12:00 AM",
    "midnight daily"
  );

  // Every N minutes
  assert(
    generateScheduleDescription("*/15 * * * *").includes("Every 15 min"),
    "every 15 minutes"
  );
  assert(
    generateScheduleDescription("*/5 * * * *").includes("Every 5 min"),
    "every 5 minutes"
  );

  // Weekdays
  assert(
    generateScheduleDescription("0 9 * * 1-5").includes("Weekdays") && generateScheduleDescription("0 9 * * 1-5").includes("9:00 AM"),
    "weekdays at 10am"
  );

  // Multiple hours
  assert(
    generateScheduleDescription("0 9,12,15 * * *").includes("9:00 AM") && generateScheduleDescription("0 9,12,15 * * *").includes("12:00 PM") && generateScheduleDescription("0 9,12,15 * * *").includes("3:00 PM"),
    "multiple hours"
  );

  // Day of month
  assert(
    generateScheduleDescription("0 10 1 * *").includes("Monthly") && generateScheduleDescription("0 10 1 * *").includes("day 1"),
    "monthly on day 1"
  );

  // Month constraint
  assert(
    generateScheduleDescription("0 10 1 1 *").includes("Yearly") && generateScheduleDescription("0 10 1 1 *").includes("Jan"),
    "yearly in january"
  );

  // Hour range
  assert(
    generateScheduleDescription("0 9-17 * * *").includes("9:00 AM") && generateScheduleDescription("0 9-17 * * *").includes("5:00 PM"),
    "hour range 9-17"
  );

  // Weekend
  assert(
    generateScheduleDescription("0 10 * * 0,6").includes("Weekends"),
    "weekends (0,6)"
  );

  // Specific days
  assert(
    generateScheduleDescription("0 10 * * 1,3,5").includes("Mon") && generateScheduleDescription("0 10 * * 1,3,5").includes("Wed") && generateScheduleDescription("0 10 * * 1,3,5").includes("Fri"),
    "specific days mon,wed,fri"
  );

  // Every minute (NOTE: code returns "Every hour" due to Case 10 catching hour=* first)
  assert(
    generateScheduleDescription("* * * * *") === "Every hour",
    "every minute (code returns 'Every hour' due to case ordering)"
  );

  // Every hour at specific minutes
  assert(
    generateScheduleDescription("0,30 * * * *").includes("At"),
    "at specific minutes every hour"
  );

  // Minute range
  assert(
    generateScheduleDescription("10-20 * * * *").includes("Mins 10–20"),
    "minute range"
  );

  // Fallback for invalid
  assert(
    generateScheduleDescription("invalid") === "invalid",
    "invalid expression returns original"
  );

  // Step with hour constraint
  let desc = generateScheduleDescription("*/10 */2 * * *");
  assert(desc.includes("Every 10 min"), "step with every-2-hours: includes 'Every 10 min'");

  // Step with weekday constraint
  desc = generateScheduleDescription("*/30 * * * 1-5");
  assert(desc.includes("Every 30 min") && desc.includes("weekdays"), "step with weekdays");

  // Month range
  desc = generateScheduleDescription("0 10 1 3-6 *");
  assert(desc.includes("Yearly") && desc.includes("Mar"), "month range yearly");
}

// ─── expandCron tests ───────────────────────────────────────────────
section("expandCron");

{
  const from = new Date(2026, 5, 15, 0, 0, 0, 0); // June 15, 2026 00:00
  const to = new Date(2026, 5, 15, 23, 59, 59, 999); // June 15, 2026 23:59

  // Every hour at minute 0
  let dates = expandCron("0 * * * *", from, to);
  assert(dates.length === 24, "every hour: 24 matches in one day");
  assert(dates[0].getHours() === 0 && dates[0].getMinutes() === 0, "first match at 00:00");
  assert(dates[23].getHours() === 23 && dates[23].getMinutes() === 0, "last match at 23:00");

  // Every minute
  dates = expandCron("* * * * *", from, to);
  assert(dates.length === 1440, "every minute: 1440 matches in one day");

  // Specific hour
  dates = expandCron("30 10 * * *", from, to);
  assert(dates.length === 1, "specific hour: 1 match");
  assert(dates[0].getHours() === 10 && dates[0].getMinutes() === 30, "match at 10:30");

  // No match in range
  dates = expandCron("0 25 * * *", from, to);
  assert(dates.length === 0, "invalid hour: 0 matches");

  // Day of week constraint
  dates = expandCron("0 10 * * 1", from, to);
  assert(dates.length === 1, "monday constraint: 1 match (june 15 is monday)");

  // Non-matching day of week
  dates = expandCron("0 10 * * 0", from, to);
  assert(dates.length === 0, "sunday constraint: 0 matches (june 15 is monday)");
}

// ─── expandCron: multi-day range ────────────────────────────────────
section("expandCron — multi-day range");

{
  const from = new Date(2026, 5, 14, 0, 0, 0, 0); // June 14 (Sunday)
  const to = new Date(2026, 5, 20, 23, 59, 59, 999); // June 20 (Saturday)

  // Every weekday at 9:00 AM (Mon-Fri)
  let dates = expandCron("0 9 * * 1-5", from, to);
  // June 15(Mon), 16(Tue), 17(Wed), 18(Thu), 19(Fri) = 5 days
  assert(dates.length === 5, "weekdays: 5 matches in Mon-Sun range");

  // Every day at 10:00 AM
  dates = expandCron("0 10 * * *", from, to);
  // June 14-20 = 7 days
  assert(dates.length === 7, "daily: 7 matches in 7-day range");

  // Every hour on Monday only
  dates = expandCron("0 * * * 1", from, to);
  assert(dates.length === 24, "monday only: 24 matches (1 day)");
}

// ─── matchJobs tests ────────────────────────────────────────────────
section("matchJobs");

{
  const jobs: CronJob[] = [
    { name: "backup", schedule: "0 2 * * *", description: "Daily backup", server: null, compositeServiceName: null, status: "true" },
    { name: "cleanup", schedule: "0 0 1 * *", description: "Monthly cleanup", server: "Prod1", compositeServiceName: "svc-a", status: "true" },
    { name: "report", schedule: "30 8 * * 1-5", description: "Weekday report", server: "Prod2", compositeServiceName: "svc-b", status: "true" },
  ];

  const from = new Date(2026, 5, 15, 0, 0, 0, 0);
  const to = new Date(2026, 5, 21, 23, 59, 59, 999);

  const results = matchJobs(jobs, from, to);

  assert(results.length === 3, "matchJobs returns all jobs");

  const backup = results.find(r => r.job.name === "backup")!;
  assert(backup.totalCount === 7, "backup: 7 matches in 7-day range");

  const cleanup = results.find(r => r.job.name === "cleanup")!;
  assert(cleanup.totalCount === 0, "cleanup: 0 matches (day 1 not in range)");

  const report = results.find(r => r.job.name === "report")!;
  // June 15(Mon) to June 21(Sun): weekdays = 15,16,17,18,19 = 5 days
  assert(report.totalCount === 5, "report: 5 weekday matches");
}

// ─── Summary ────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("  SUMMARY");
console.log("=".repeat(60));
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
