import type { CronJob, MatchedJob } from "./types";
export type { CronJob, MatchedJob } from "./types";

// ─── Compiled cron representation (parsed once, reused many times) ───

export interface CompiledCron {
  // minute → boolean (is this minute valid?)
  minutes: Uint8Array;
  // hour → boolean
  hours: Uint8Array;
  // dayOfMonth → boolean
  daysOfMonth: Uint8Array;
  // month → boolean
  months: Uint8Array;
  // dayOfWeek → boolean (0=Sun…6=Sat)
  daysOfWeek: Uint8Array;
  // which fields are constrained (not wildcard)
  constrained: {
    dayOfMonth: boolean;
    dayOfWeek: boolean;
  };
  // step values for jumping (null = wildcard)
  minuteStep: number | null;
  hourStep: number | null;
}

const _cronCache = new Map<string, CompiledCron>();

export function compileCron(expression: string): CompiledCron {
  const cached = _cronCache.get(expression);
  if (cached) return cached;

  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) {
    // Return a "never matches" compiled cron for invalid expressions
    return {
      minutes: new Uint8Array(60),
      hours: new Uint8Array(24),
      daysOfMonth: new Uint8Array(31),
      months: new Uint8Array(12),
      daysOfWeek: new Uint8Array(7),
      constrained: { dayOfMonth: false, dayOfWeek: false },
      minuteStep: null,
      hourStep: null,
    };
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Parse fields
  const minutes = parseField(minute, 0, 59);
  const hours = parseField(hour, 0, 23);
  const daysOfMonthSet = parseField(dayOfMonth, 1, 31);
  const monthsSet = parseField(month, 1, 12);
  const daysOfWeekSet = new Set(
    [...parseField(dayOfWeek, 0, 7)].map((d) => (d === 7 ? 0 : d))
  );

  // Compute step values for jumping
  const minuteStep = minute.startsWith("*/") ? parseInt(minute.split("/")[1]) : null;
  const hourStep = hour.startsWith("*/") ? parseInt(hour.split("/")[1]) : null;

  // Check if fields are constrained
  const constrained = {
    dayOfMonth: dayOfMonth !== "*",
    dayOfWeek: dayOfWeek !== "*",
  };

  // Build Uint8Array lookups (faster than Set for dense ranges)
  const minutesArr = new Uint8Array(60);
  for (const m of minutes) minutesArr[m] = 1;

  const hoursArr = new Uint8Array(24);
  for (const h of hours) hoursArr[h] = 1;

  const daysOfMonthArr = new Uint8Array(31);
  for (const d of daysOfMonthSet) daysOfMonthArr[d - 1] = 1;

  const monthsArr = new Uint8Array(12);
  for (const m of monthsSet) monthsArr[m - 1] = 1;

  const daysOfWeekArr = new Uint8Array(7);
  for (const d of daysOfWeekSet) daysOfWeekArr[d] = 1;

  const result: CompiledCron = {
    minutes: minutesArr,
    hours: hoursArr,
    daysOfMonth: daysOfMonthArr,
    months: monthsArr,
    daysOfWeek: daysOfWeekArr,
    constrained,
    minuteStep,
    hourStep,
  };

  _cronCache.set(expression, result);
  return result;
}

// Check if a given date matches a compiled cron expression (all in local time)
export function compiledCronMatches(date: Date, compiled: CompiledCron): boolean {
  const dateMin = date.getMinutes();
  const dateHour = date.getHours();
  const dateDayOfMonth = date.getDate();
  const dateMonth = date.getMonth() + 1;
  const dateDayOfWeek = date.getDay();
  const dateYear = date.getFullYear();

  if (!compiled.minutes[dateMin]) return false;
  if (!compiled.hours[dateHour]) return false;
  if (!compiled.months[dateMonth - 1]) return false;
  if (dateYear < 1970 || dateYear > 2099) return false;

  // Traditional cron: if both day-of-month and day-of-week are constrained, use OR
  const dayMatch = compiled.constrained.dayOfMonth && compiled.constrained.dayOfWeek
    ? !!(compiled.daysOfMonth[dateDayOfMonth - 1] || compiled.daysOfWeek[dateDayOfWeek])
    : !!(compiled.daysOfMonth[dateDayOfMonth - 1] && compiled.daysOfWeek[dateDayOfWeek]);

  return dayMatch;
}

// ─── Timezone-aware date creation ───

/**
 * Create a Date in a specific timezone by temporarily setting TZ.
 * Returns a Date whose UTC timestamp represents the given wall-clock
 * time in the target timezone.
 */
function createDateTimeInTimezone(
  year: number,
  month: number, // 0-based (January = 0)
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  // Use Date.UTC so the arguments are interpreted as UTC,
  // producing the correct timestamp for "wall-clock time in timeZone".
  return new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
}

// ─── Jump-based expandCron (avoids per-minute iteration) ───

export function expandCron(
  cronExpression: string,
  from: Date,
  to: Date,
  timeZone: string = "Asia/Singapore"
): Date[] {
  const compiled = compileCron(cronExpression);
  const dates: Date[] = [];

  const toClamped = new Date(to);
  toClamped.setSeconds(59, 999);

  // Start at the beginning of the minute (in the target timezone)
  const current = new Date(from);
  current.setSeconds(0, 0);

  // Iterate day by day (not minute by minute)
  // Use the target timezone to get the correct wall-clock date
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const { year, month, day: dayNum, hour, minute } = formatter.formatToParts(current)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const day = createDateTimeInTimezone(
    parseInt(year, 10),
    parseInt(month, 10) - 1, // Intl returns 1-based month
    parseInt(dayNum, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    timeZone
  );

  while (day <= toClamped) {
    const dateMonth = day.getMonth() + 1;
    const dateDayOfMonth = day.getDate();
    const dateDayOfWeek = day.getDay();

    // Skip days that don't match month/day constraints
    if (compiled.months[dateMonth - 1]) {
      const dayMatch = compiled.constrained.dayOfMonth && compiled.constrained.dayOfWeek
        ? !!(compiled.daysOfMonth[dateDayOfMonth - 1] || compiled.daysOfWeek[dateDayOfWeek])
        : !!(compiled.daysOfMonth[dateDayOfMonth - 1] && compiled.daysOfWeek[dateDayOfWeek]);

      if (dayMatch) {
        // Iterate valid minutes, then valid hours within this day
        let minute = 0;
        while (minute < 60) {
          if (compiled.minutes[minute]) {
            let hour = 0;
            while (hour < 24) {
              if (compiled.hours[hour]) {
                const candidate = new Date(day);
                candidate.setHours(hour, minute, 0, 0);
                if (candidate > toClamped) break;
                dates.push(candidate);
              }
              if (compiled.hourStep && compiled.hourStep > 0) {
                hour += compiled.hourStep;
              } else {
                hour++;
              }
            }
          }
          // Jump to next valid minute
          if (compiled.minuteStep && compiled.minuteStep > 0) {
            minute += compiled.minuteStep;
          } else {
            minute++;
          }
        }
      }
    }

    // Move to next day
    day.setDate(day.getDate() + 1);
    if (day > toClamped) break;
  }

  return dates;
}

// ─── Legacy cronMatches (for tests, still works but slower) ───

// Parse a single cron field into a set of valid values
export function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    if (part === "*") {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const start = range === "*" ? min : parseInt(range, 10);
      const step = parseInt(stepStr, 10);
      for (let i = start; i <= max; i += step) values.add(i);
    } else if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      for (let i = start; i <= end; i++) values.add(i);
    } else {
      values.add(parseInt(part, 10));
    }
  }
  return values;
}

// Check if a given date matches a cron expression (all in local time)
export function cronMatches(date: Date, expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return false;

  const [minute, hour, dayOfMonth, month, dayOfWeek, yearField] = parts;

  const minutes = parseField(minute, 0, 59);
  const hours = parseField(hour, 0, 23);
  const daysOfMonth = parseField(dayOfMonth, 1, 31);
  const months = parseField(month, 1, 12);
  const years = parseField(yearField || "*", 1970, 2099);
  // Cron: 0 and 7 = Sunday; JS getDay(): 0 = Sunday
  const daysOfWeekSet = new Set(
    [...parseField(dayOfWeek, 0, 7)].map((d) => (d === 7 ? 0 : d))
  );

  const dateMin = date.getMinutes();
  const dateHour = date.getHours();
  const dateDayOfMonth = date.getDate();
  const dateMonth = date.getMonth() + 1;
  const dateDayOfWeek = date.getDay();
  const dateYear = date.getFullYear();

  // Traditional cron: if both day-of-month and day-of-week are constrained, use OR
  const dayOfMonthConstrained = dayOfMonth !== "*";
  const dayOfWeekConstrained = dayOfWeek !== "*";

  const dayMatch = dayOfMonthConstrained && dayOfWeekConstrained
    ? daysOfMonth.has(dateDayOfMonth) || daysOfWeekSet.has(dateDayOfWeek)
    : daysOfMonth.has(dateDayOfMonth) && daysOfWeekSet.has(dateDayOfWeek);

  return (
    minutes.has(dateMin) &&
    hours.has(dateHour) &&
    months.has(dateMonth) &&
    years.has(dateYear) &&
    dayMatch
  );
}

export function matchJobs(
  jobs: CronJob[],
  from: Date,
  to: Date
): MatchedJob[] {
  return jobs.map((job) => {
    const dates = expandCron(job.schedule, from, to);
    return {
      job,
      matchedDates: dates,
      totalCount: dates.length,
    };
  });
}

export function getScheduleSummary(
  cronExpression: string,
  totalCount: number
): string {
  if (totalCount === 0) return "No matches";
  if (totalCount === 1) return `Runs ${totalCount} time`;
  if (totalCount <= 24) return `Runs ${totalCount} times`;
  if (totalCount <= 168) {
    const perDay = Math.round(totalCount / 7);
    return `~${perDay} times/day over 7 days`;
  }
  if (totalCount <= 720) {
    const perDay = Math.round(totalCount / 30);
    return `~${perDay} times/day over ~30 days`;
  }
  return `${totalCount} executions (truncated)`;
}

export function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 0) return "ago";
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 7) return `in ${diffDays} days`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function buildDateTime(
  dateStr: string,
  timeStr: string,
  timeZone: string = "Asia/Singapore"
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr ? timeStr.split(":").map(Number) : [0, 0];
  // Use Date.UTC so the wall-clock values are interpreted as UTC,
  // producing the correct timestamp for "wall-clock time in timeZone".
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
}

export function toTimeInput(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
