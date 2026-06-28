import type { CronJob, MatchedJob } from "./types";
export type { CronJob, MatchedJob } from "./types";

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
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr ? timeStr.split(":").map(Number) : [0, 0];
  return new Date(year, month - 1, day, hour, minute);
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

function cronDowToJs(d: number): number {
  return d === 7 ? 0 : d;
}

function formatDowValues(dowValues: number[]): string {
  return dowValues.map((d) => DAY_NAMES[cronDowToJs(d)]).join(", ");
}

function formatHour(h: number, minute: number | null = null): string {
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const minStr = minute !== null ? `:${String(minute).padStart(2, "0")}` : ":00";
  return `${display}${minStr} ${period}`;
}

function formatHourRange(start: number, end: number): string {
  return `${formatHour(start)}–${formatHour(end)}`;
}

export function generateScheduleDescription(schedule: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return schedule;

  const [minute, hour, dayOfMonth, month, dayOfWeek, yearField] = parts;

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
  const singleDow = !dayOfWeek.includes(",") && !dayOfWeek.includes("-") && dayOfWeek !== "*" ? parseInt(dayOfWeek) : null;
  const isWeekdays = (dowRange && dowRange[0] === 1 && dowRange[1] === 5) ||
                      (dowValues && dowValues.length === 5 && dowValues[0] === 1 && dowValues[4] === 5);
  const isWeekends = (dowRange && dowRange[0] === 0 && dowRange[1] === 6) ||
                      (dowValues && dowValues.length === 2 && dowValues[0] === 0 && dowValues[1] === 6);
  const isAllDays = (dowRange && dowRange[0] === 0 && dowRange[1] === 6) ||
                    (dowRange && dowRange[0] === 1 && dowRange[1] === 7) ||
                    (dowValues && dowValues.length === 7);
  const isRawAllDays = dayOfWeek === "0-6" || dayOfWeek === "1-7" || isAllDays;

  // Check for day of month constraint (full range 1-31 = unconstrained)
  const isDayOfMonth = dayOfMonth !== "*" && !(dayOfMonth.includes("-") && (() => { const r = dayOfMonth.split("-").map(Number); return r[0] === 1 && r[1] === 31; })());
  const dayOfMonthValues = isDayOfMonth && dayOfMonth.includes(",") ? dayOfMonth.split(",").map(Number) : null;

  // Check for month constraint (full range 1-12 = unconstrained)
  const isMonth = month !== "*" && !(month.includes("-") && (() => { const r = month.split("-").map(Number); return r[0] === 1 && r[1] === 12; })());
  const monthValues = isMonth && month.includes(",") ? month.split(",").map(Number) : null;
  const monthRange = isMonth && month.includes("-") ? month.split("-").map(Number) : null;
  const isYear = yearField && yearField !== "*";
  const yearValues = isYear && yearField.includes(",") ? yearField.split(",").map(Number) : null;
  const yearRange = isYear && yearField.includes("-") ? yearField.split("-").map(Number) : null;

  // Extract single minute value for time display
  const minuteNum = !minute.includes(",") && !minute.includes("-") && minute !== "*" && !minute.startsWith("*") ? parseInt(minute) : null;

  // Check for quarterly months (exactly 4 months with gap of 3)
  const isQuarterly = monthValues && monthValues.length === 4 && monthValues[3] - monthValues[0] === 9;

  // === Build description ===

  // Case 1: Every N minutes (with possible hour/day/month constraints)
  if (minuteStep) {
    let desc = `Every ${minuteStep} min`;
    if (hourRange) {
      desc += `, ${formatHourRange(hourRange[0], hourRange[1])}`;
    } else if (hourValues && hourValues.length <= 6) {
    desc += `, ${hourValues.map((h) => formatHour(h, minuteNum)).join(", ")}`;
    } else if (singleHour !== null) {
      desc += `, at ${formatHour(singleHour)}`;
    }
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues && dowValues.length > 0) desc += `, ${formatDowValues(dowValues)}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 2: Single minute + single hour + no day/month constraints = "Daily at H:MM"
  if (singleHour !== null && !isDayOfMonth && !isMonth && dayOfWeek === "*") {
    let desc = `Daily at ${formatHour(singleHour, minuteNum)}`;
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 3: Single minute + multiple hours = "Daily at H1:00, H2:00, ..."
  if (hourValues && hourValues.length > 1 && !isDayOfMonth && !isMonth && dayOfWeek === "*") {
    let desc = `Daily at ${hourValues.map((h) => formatHour(h, minuteNum)).join(", ")}`;
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 4: Single minute + single hour + day of week = "Weekly on X at H:MM" etc.
  if (singleHour !== null && !isDayOfMonth && !isMonth) {
    if (isWeekdays) {
      let desc = `Weekdays at ${formatHour(singleHour, minuteNum)}`;
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    if (isWeekends) {
      let desc = `Weekends at ${formatHour(singleHour, minuteNum)}`;
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    if (isAllDays) {
      let desc = `Daily at ${formatHour(singleHour, minuteNum)}`;
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    if (singleDow !== null) {
      let desc = `Weekly on ${DAY_NAMES[cronDowToJs(singleDow)]} at ${formatHour(singleHour, minuteNum)}`;
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    if (dowValues) {
      let desc = dowValues.length === 1 ? `Weekly on ${DAY_NAMES[cronDowToJs(dowValues[0])]} at ${formatHour(singleHour, minuteNum)}` : `${formatDowValues(dowValues)} at ${formatHour(singleHour, minuteNum)}`;
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
  }

  // Case 5: Single minute + single hour + day of month = "Monthly on D at H:MM"
  if (singleHour !== null && isDayOfMonth && !isMonth && dayOfWeek === "*") {
    let desc;
    if (dayOfMonthValues && dayOfMonthValues.length <= 4) {
      desc = `Monthly on days ${dayOfMonthValues.join(", ")} at ${formatHour(singleHour, minuteNum)}`;
    } else {
      desc = `Monthly on day ${dayOfMonth} at ${formatHour(singleHour, minuteNum)}`;
    }
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 6: Single minute + single hour + month = "Quarterly on M on D at H:MM" or "Monthly on M..."
  if (singleHour !== null && isMonth && dayOfWeek === "*") {
    let timePart = `at ${formatHour(singleHour, minuteNum)}`;
    if (isDayOfMonth) {
      if (dayOfMonthValues && dayOfMonthValues.length <= 4) {
        timePart = `on days ${dayOfMonthValues.join(", ")} ${timePart}`;
      } else {
        timePart = `on day ${dayOfMonth} ${timePart}`;
      }
    }
    if (isQuarterly) {
      let desc = `Quarterly ${timePart}`;
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    if (monthRange) {
      let desc = `Yearly, between ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      desc += ` ${timePart}`;
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    if (monthValues && monthValues.length <= 4) {
      let desc = `${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      desc += ` ${timePart}`;
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    let desc = `Yearly, in ${MONTH_NAMES[parseInt(month) - 1]}`;
    desc += ` ${timePart}`;
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 7: Single minute + single hour + day of month + day of week
  if (singleHour !== null && isDayOfMonth && dayOfWeek !== "*") {
    let desc;
    if (dayOfMonthValues && dayOfMonthValues.length <= 4) {
      desc = `Monthly on days ${dayOfMonthValues.join(", ")} at ${formatHour(singleHour, minuteNum)}`;
    } else {
      desc = `Monthly on day ${dayOfMonth} at ${formatHour(singleHour, minuteNum)}`;
    }
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues) desc += `, ${formatDowValues(dowValues)}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 8: Multiple minutes (At :N, :M, ...)
  if (minute.includes(",")) {
    const mins = minute.split(",").map(Number);
    let desc = mins.length <= 4
      ? `At ${mins.map((m) => `:${String(m).padStart(2, "0")}`).join(", ")}`
      : `At :${minute}`;
    if (hourRange) desc += `, ${formatHourRange(hourRange[0], hourRange[1])}`;
    else if (hourValues && hourValues.length <= 6) desc += `, ${hourValues.map((h) => formatHour(h, minuteNum)).join(", ")}`;
    else if (singleHour !== null) desc += `, at ${formatHour(singleHour, minuteNum)}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues) desc += `, ${formatDowValues(dowValues)}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 9: Minute range
  if (minute.includes("-")) {
    const [s, e] = minute.split("-").map(Number);
    let desc = `Mins ${s}–${e}`;
    if (hourRange) desc += `, ${formatHourRange(hourRange[0], hourRange[1])}`;
    else if (hourValues && hourValues.length <= 6) desc += `, ${hourValues.map((h) => formatHour(h, minuteNum)).join(", ")}`;
    else if (singleHour !== null) desc += `, at ${formatHour(singleHour, minuteNum)}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues) desc += `, ${formatDowValues(dowValues)}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 10: Every hour (minute = * already handled in Case 11)
  if (hour === "*") {
    // Specific minute every hour: "At :MM, every hour"
    if (minute !== "*") {
      if (isRawAllDays) {
        let desc = "Every hour";
        if (isYear) {
          if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
          else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
          else desc += `, ${yearField}`;
        }
        return desc;
      }
      let desc = `At :${minute}`;
      if (isWeekdays) desc += ", weekdays";
      else if (isWeekends) desc += ", weekends";
      else if (dowValues && dowValues.length > 0 && !isAllDays) desc += `, ${formatDowValues(dowValues)}`;
      if (isMonth) {
        if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
        else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
        else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
      }
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    if (dayOfWeek !== "*" && !isWeekdays && !isWeekends && !isAllDays && dowValues) {
      let desc = `${formatDowValues(dowValues)} every hour`;
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    let desc = "Every hour";
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 11: Every minute (minute = *) with hour range 0-23 = every minute
  if (minute === "*" && (hour === "*" || hour === "0-23")) {
    if (isWeekdays) {
      let desc = "Every minute, weekdays";
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    if (isWeekends) {
      let desc = "Every minute, weekends";
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    if (dowValues && dowValues.length > 0) {
      let desc = `${formatDowValues(dowValues)} every minute`;
      if (isYear) {
        if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
        else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
        else desc += `, ${yearField}`;
      }
      return desc;
    }
    let desc = "Every minute";
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 12: Every minute at specific hours
  if (minute === "*" && hourValues && hourValues.length > 0) {
    let desc = `Every minute`;
    desc += `, ${hourValues.map((h) => formatHour(h, minuteNum)).join(", ")}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues && dowValues.length > 0) desc += `, ${formatDowValues(dowValues)}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 13: Every minute in hour range
  if (minute === "*" && hourRange) {
    let desc = `Every minute, ${formatHourRange(hourRange[0], hourRange[1])}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues && dowValues.length > 0) desc += `, ${formatDowValues(dowValues)}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 14: Specific minute with hour range (e.g., "0 9-17 * * *")
  if (hourRange) {
    let desc = `At :${minute}`;
    desc += `, ${formatHourRange(hourRange[0], hourRange[1])}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues && dowValues.length > 0) desc += `, ${formatDowValues(dowValues)}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Case 15: Specific minute with specific hours (e.g., "0 9,12,15 * * *")
  if (hourValues && hourValues.length > 0) {
    let desc = `At :${minute}`;
    desc += `, ${hourValues.map(formatHour).join(", ")}`;
    if (isWeekdays) desc += ", weekdays";
    else if (isWeekends) desc += ", weekends";
    else if (dowValues && dowValues.length > 0) desc += `, ${formatDowValues(dowValues)}`;
    if (isMonth) {
      if (monthRange) desc += `, ${MONTH_NAMES[monthRange[0] - 1]}–${MONTH_NAMES[monthRange[1] - 1]}`;
      else if (monthValues && monthValues.length <= 4) desc += `, ${monthValues.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
      else desc += `, ${MONTH_NAMES[parseInt(month) - 1]}`;
    }
    if (isYear) {
      if (yearRange) desc += `, ${yearRange[0]}–${yearRange[1]}`;
      else if (yearValues && yearValues.length <= 4) desc += `, ${yearValues.join(", ")}`;
      else desc += `, ${yearField}`;
    }
    return desc;
  }

  // Fallback
  return schedule;
}
