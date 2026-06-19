export interface CronJob {
  name: string;
  schedule: string;
  description: string;
}

export interface MatchedJob {
  job: CronJob;
  matchedDates: Date[];
  totalCount: number;
}

// Parse a single cron field into a set of valid values
function parseField(field: string, min: number, max: number): Set<number> {
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

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const minutes = parseField(minute, 0, 59);
  const hours = parseField(hour, 0, 23);
  const daysOfMonth = parseField(dayOfMonth, 1, 31);
  const months = parseField(month, 1, 12);
  // Cron: 0 and 7 = Sunday; JS getDay(): 0 = Sunday
  const daysOfWeekSet = new Set(
    [...parseField(dayOfWeek, 0, 7)].map((d) => (d === 7 ? 0 : d))
  );

  const dateMin = date.getMinutes();
  const dateHour = date.getHours();
  const dateDayOfMonth = date.getDate();
  const dateMonth = date.getMonth() + 1;
  const dateDayOfWeek = date.getDay();

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
    dayMatch
  );
}

export function expandCron(
  cronExpression: string,
  from: Date,
  to: Date
): Date[] {
  const dates: Date[] = [];
  const current = new Date(from);
  current.setSeconds(0, 0);

  const toClamped = new Date(to);
  toClamped.setSeconds(59, 999);

  while (current <= toClamped) {
    if (cronMatches(current, cronExpression)) {
      dates.push(new Date(current));
    }
    current.setMinutes(current.getMinutes() + 1);
  }

  return dates;
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
  if (totalCount <= 500) return `${totalCount} executions (showing all)`;
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

export function buildDateTime(dateStr: string, timeStr: string): Date {
  if (!timeStr) return new Date(dateStr + "T00:00:00");
  return new Date(`${dateStr}T${timeStr}`);
}

export function toTimeInput(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
