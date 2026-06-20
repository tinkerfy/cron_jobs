export interface CronJob {
  name: string;
  schedule: string;
  description: string;
  server: string | null;
  compositeservicename: string | null;
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

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${period}`;
}

function formatHourRange(start: number, end: number): string {
  return `${formatHour(start)}–${formatHour(end)}`;
}

export function generateScheduleDescription(schedule: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return schedule;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Check for step pattern on minute
  const minuteStep = minute.startsWith("*/") ? parseInt(minute.split("/")[1]) : null;

  // Check for single hour value
  const singleHour = !hour.includes(",") && !hour.includes("-") && hour !== "*" && !hour.startsWith("*") ? parseInt(hour) : null;

  // Check for multiple hour values
  const hourValues = hour.includes(",") ? hour.split(",").map(Number) : null;

  // Check for hour range
  const hourRange = hour.includes("-") ? hour.split("-").map(Number) : null;

  // Check for day of week constraint
  const dowValues = dayOfWeek.includes(",") ? dayOfWeek.split(",").map(Number) : null;
  const dowRange = dayOfWeek.includes("-") ? dayOfWeek.split("-").map(Number) : null;
  const isWeekdays = (dowRange && dowRange[0] === 1 && dowRange[1] === 5) ||
                     (dowValues && dowValues.length === 5 && dowValues[0] === 1 && dowValues[4] === 5);
  const isWeekends = (dowRange && dowRange[0] === 0 && dowRange[1] === 6) ||
                     (dowValues && dowValues.length === 2 && dowValues[0] === 0 && dowValues[1] === 6);

  // Check for day of month constraint (full range 1-31 = unconstrained)
  const isDayOfMonth = dayOfMonth !== "*" && !(dayOfMonth.includes("-") && (() => { const r = dayOfMonth.split("-").map(Number); return r[0] === 1 && r[1] === 31; })());
  const dayOfMonthValues = isDayOfMonth && dayOfMonth.includes(",") ? dayOfMonth.split(",").map(Number) : null;

  // Check for month constraint (full range 1-12 = unconstrained)
  const isMonth = month !== "*" && !(month.includes("-") && (() => { const r = month.split("-").map(Number); return r[0] === 1 && r[1] === 12; })());
  const monthValues = isMonth && month.includes(",") ? month.split(",").map(Number) : null;
  const monthRange = isMonth && month.includes("-") ? month.split("-").map(Number) : null;

  // === Build description ===

  // Case 1: Every N minutes (with possible hour/day/month constraints)
  if (minuteStep) {
    let desc = `Every ${minuteStep} min`;
    if (hourRange) {
      desc += `, ${formatHourRange(hourRange[0], hourRange[1])}`;
    } else if (hourValues && hourValues.length <= 6) {
      desc += `, ${hourValues.map(formatHour).join(", ")}`;
    } else if (singleHour !== null) {
      desc += `, at ${formatHour(singleHour)}`;
    }
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues && dowValues.length > 0) desc += `, ${dowValues.map((d) => DAY_NAMES[d]).join(", ")}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    return desc;
  }

  // Case 2: Single minute + single hour + no day/month constraints = "Daily at H:MM"
  if (singleHour !== null && !isDayOfMonth && !isMonth && dayOfWeek === "*") {
    return `Daily at ${formatHour(singleHour)}`;
  }

  // Case 3: Single minute + multiple hours = "Daily at H1:00, H2:00, ..."
  if (singleHour !== null && hourValues && hourValues.length > 1 && !isDayOfMonth && !isMonth && dayOfWeek === "*") {
    return `Daily at ${hourValues.map(formatHour).join(", ")}`;
  }

  // Case 4: Single minute + single hour + day of week = "Weekdays at H:00" etc.
  if (singleHour !== null && !isDayOfMonth && !isMonth) {
    if (isWeekdays) return `Weekdays at ${formatHour(singleHour)}`;
    if (isWeekends) return `Weekends at ${formatHour(singleHour)}`;
    if (dowValues) return `${dowValues.map((d) => DAY_NAMES[d]).join(", ")} at ${formatHour(singleHour)}`;
  }

  // Case 5: Single minute + single hour + day of month = "Monthly on D at H:00"
  if (singleHour !== null && isDayOfMonth && !isMonth && dayOfWeek === "*") {
    if (dayOfMonthValues && dayOfMonthValues.length <= 4) {
      return `Monthly on days ${dayOfMonthValues.join(", ")} at ${formatHour(singleHour)}`;
    }
    return `Monthly on day ${dayOfMonth} at ${formatHour(singleHour)}`;
  }

  // Case 6: Single minute + single hour + month = "Yearly on M on D at H:00"
  if (singleHour !== null && isMonth && dayOfWeek === "*") {
    let timePart = `at ${formatHour(singleHour)}`;
    if (isDayOfMonth) {
      if (dayOfMonthValues && dayOfMonthValues.length <= 4) {
        timePart = `on days ${dayOfMonthValues.join(", ")} ${timePart}`;
      } else {
        timePart = `on day ${dayOfMonth} ${timePart}`;
      }
    }
    if (monthRange) return `Yearly, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]} ${timePart}`;
    if (monthValues && monthValues.length <= 4) return `Yearly, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")} ${timePart}`;
    return `Yearly in ${MONTH_NAMES[parseInt(month) - 1]} ${timePart}`;
  }

  // Case 7: Single minute + single hour + day of month + day of week
  if (singleHour !== null && isDayOfMonth && dayOfWeek !== "*") {
    let desc: string;
    if (dayOfMonthValues && dayOfMonthValues.length <= 4) {
      desc = `Monthly on days ${dayOfMonthValues.join(", ")} at ${formatHour(singleHour)}`;
    } else {
      desc = `Monthly on day ${dayOfMonth} at ${formatHour(singleHour)}`;
    }
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues) desc += `, ${dowValues.map((d) => DAY_NAMES[d]).join(", ")}`;
    return desc;
  }

  // Case 8: Multiple minutes (At :N, :M, ...)
  if (minute.includes(",")) {
    const mins = minute.split(",").map(Number);
    let desc = mins.length <= 4
      ? `At :${mins.map((m) => String(m).padStart(2, "0")).join(", ")}`
      : `At :${minute}`;
    if (hourRange) desc += `, ${formatHourRange(hourRange[0], hourRange[1])}`;
    else if (hourValues && hourValues.length <= 6) desc += `, ${hourValues.map(formatHour).join(", ")}`;
    else if (singleHour !== null) desc += `, at ${formatHour(singleHour)}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues) desc += `, ${dowValues.map((d) => DAY_NAMES[d]).join(", ")}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    return desc;
  }

  // Case 9: Minute range
  if (minute.includes("-")) {
    const [s, e] = minute.split("-").map(Number);
    let desc = `Mins ${s}–${e}`;
    if (hourRange) desc += `, ${formatHourRange(hourRange[0], hourRange[1])}`;
    else if (hourValues && hourValues.length <= 6) desc += `, ${hourValues.map(formatHour).join(", ")}`;
    else if (singleHour !== null) desc += `, at ${formatHour(singleHour)}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues) desc += `, ${dowValues.map((d) => DAY_NAMES[d]).join(", ")}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    return desc;
  }

  // Case 10: Every hour (minute = * already handled in Case 11)
  if (hour === "*") {
    // Specific minute every hour: "At :MM, every hour"
    if (minute !== "*") {
      let desc = `At :${minute}`;
      if (isWeekdays) desc += ", weekdays";
      else if (isWeekends) desc += ", weekends";
      else if (dowValues && dowValues.length > 0) desc += `, ${dowValues.map((d) => DAY_NAMES[d]).join(", ")}`;
      if (isMonth) {
        if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
        else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
        else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
      }
      return desc;
    }
    if (dayOfWeek !== "*" && !isWeekdays && !isWeekends && dowValues) {
      return `${dowValues.map((d) => DAY_NAMES[d]).join(", ")} every hour`;
    }
    return "Every hour";
  }

  // Case 11: Every minute (minute = *) with hour range 0-23 = every minute
  if (minute === "*" && (hour === "*" || hour === "0-23")) {
    if (isWeekdays) return "Every minute, weekdays";
    if (isWeekends) return "Every minute, weekends";
    if (dowValues && dowValues.length > 0) return `${dowValues.map((d) => DAY_NAMES[d]).join(", ")} every minute`;
    return "Every minute";
  }

  // Case 12: Every minute at specific hours
  if (minute === "*" && hourValues && hourValues.length > 0) {
    let desc = `Every minute`;
    desc += `, ${hourValues.map(formatHour).join(", ")}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues && dowValues.length > 0) desc += `, ${dowValues.map((d) => DAY_NAMES[d]).join(", ")}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    return desc;
  }

  // Case 13: Every minute in hour range
  if (minute === "*" && hourRange) {
    let desc = `Every minute, ${formatHourRange(hourRange[0], hourRange[1])}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues && dowValues.length > 0) desc += `, ${dowValues.map((d) => DAY_NAMES[d]).join(", ")}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    return desc;
  }

  // Case 14: Specific minute with hour range (e.g., "0 9-17 * * *")
  if (hourRange) {
    let desc = `At :${minute}`;
    desc += `, ${formatHourRange(hourRange[0], hourRange[1])}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues && dowValues.length > 0) desc += `, ${dowValues.map((d) => DAY_NAMES[d]).join(", ")}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    return desc;
  }

  // Case 15: Specific minute with specific hours (e.g., "0 9,12,15 * * *")
  if (hourValues && hourValues.length > 0) {
    let desc = `At :${minute}`;
    desc += `, ${hourValues.map(formatHour).join(", ")}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues && dowValues.length > 0) desc += `, ${dowValues.map((d) => DAY_NAMES[d]).join(", ")}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    return desc;
  }

  // Fallback
  return schedule;
}
