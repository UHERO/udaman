import {
  addMonths,
  addQuarters,
  addYears,
  differenceInDays,
  format,
  fromUnixTime,
  isAfter,
  isToday,
  isValid,
  isYesterday,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";

/* Functions for generating date lists for use in tables, charts, etc. Initially used in CPI-RPP portal */

function generateDates(
  startDate: Date,
  endDate: Date,
  frequency: string, // "M" | "Q" | "A"
  formatString?: string,
): string[] {
  if (
    !startDate ||
    !endDate ||
    isNaN(startDate.getTime()) ||
    isNaN(endDate.getTime())
  ) {
    throw new Error("generateDates: invalid dates passed as arguments");
  }

  if (isAfter(startDate, endDate)) {
    throw new Error(
      "generateDates: startDate must be before or equal to endDate",
    );
  }

  switch (frequency) {
    case "M":
      return generateMonths(startDate, endDate, formatString);
    case "Q":
      return generateQuarters(startDate, endDate, formatString);
    case "A":
      return generateYears(startDate, endDate, formatString);
    default:
      return generateMonths(startDate, endDate, formatString);
  }
}

function generateMonths(
  startDate: Date,
  endDate: Date,
  formatString: string = "yyyy-MM",
): string[] {
  const months: string[] = [];
  let current = startOfMonth(startDate);
  const end = startOfMonth(endDate);

  while (!isAfter(current, end)) {
    months.push(format(current, formatString));
    current = addMonths(current, 1);
  }

  return months;
}

function generateQuarters(
  startDate: Date,
  endDate: Date,
  formatString: string = "yyyy-'Q'Q",
): string[] {
  const quarters: string[] = [];
  let current = startOfQuarter(startDate);
  const end = startOfQuarter(endDate);

  while (!isAfter(current, end)) {
    quarters.push(format(current, formatString));
    current = addQuarters(current, 1);
  }

  return quarters;
}

function generateYears(
  startDate: Date,
  endDate: Date,
  formatString: string = "yyyy",
): string[] {
  const years: string[] = [];
  let current = startOfYear(startDate);
  const end = startOfYear(endDate);

  while (!isAfter(current, end)) {
    years.push(format(current, formatString));
    current = addYears(current, 1);
  }

  return years;
}

/**
 * MySQL DATE columns are calendar dates with no time zone, but the driver
 * materializes them as JS Dates at UTC midnight. Formatting those through
 * local-time APIs (date-fns `format`, `toLocaleDateString`) shifts them back
 * a day anywhere west of UTC — always go through these helpers instead.
 */

/** DATE-column value → "yyyy-MM-dd" string, using the UTC calendar day. */
function isoDate(date: Date | string): string {
  return typeof date === "string"
    ? date.slice(0, 10)
    : date.toISOString().slice(0, 10);
}

/** DATE-column value → a local Date on the same calendar day, safe for date-fns `format`. */
function utcDay(date: Date | string): Date {
  const [y, m, d] = isoDate(date).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a DATE-column value at a series' native frequency resolution:
 * year → "2025", quarter → "2025Q1", month → "2025-01", anything else
 * (semi/week/day/unknown) → "yyyy-MM-dd". Accepts full frequency names
 * ("month") or letter codes ("M").
 */
function freqDate(date: Date | string, freq?: string | null): string {
  const iso = isoDate(date);
  switch (freq?.toLowerCase()) {
    case "year":
    case "annual":
    case "a":
      return iso.slice(0, 4);
    case "quarter":
    case "q": {
      const q = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
      return `${iso.slice(0, 4)}Q${q}`;
    }
    case "month":
    case "m":
      return iso.slice(0, 7);
    default:
      return iso;
  }
}

/** Try to keep display formats consistent across all systems */
const uheroDate = (date: Date | string, freq?: string) => {
  const day = utcDay(date);
  switch (freq) {
    case "M":
      return format(day, "MMM yyyy");
    case "Q":
      return format(day, "yyyy QQQ");
    case "A":
      return format(day, "yyyy");
    default:
      return format(day, "yyyy-MM-dd");
  }
};

/** Generates the age field in series table. Taken from JP's ruby version. Unsure why
 * they settled on the 100 day and 10 month intervals.
 */
function dpAgeCode(updatedAt: string, pseudoHistory: boolean) {
  const now = new Date();
  const createdAt = new Date(updatedAt);
  const days = differenceInDays(now, createdAt);
  const months = Math.round(days / 30.0);

  const prefix = pseudoHistory ? "*" : "";

  let ageCode;
  if (days < 100) {
    ageCode = `${days.toString().padStart(2, "0")}d`;
  } else if (months < 10) {
    ageCode = `${months}m`;
  } else {
    let years = days / 365.0;
    years = years % 1 < 0.8 ? Math.floor(years) : Math.floor(years) + 1;
    years = years === 0 ? 1 : years;
    ageCode = `${years}y`;
  }

  return prefix + ageCode;
}

function formatRuntime(runtimeSeconds: number | null): string {
  if (runtimeSeconds === null) return "-";
  return `${runtimeSeconds.toFixed(2)}s`;
}

function dateTimestamp(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null) return "-";
  const date = fromUnixTime(Number(seconds));
  return date.toLocaleString("en-US", {
    timeZone: "Pacific/Honolulu",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Ensure datestring is in standard yyyy-mm-dd format. If optional array provided, ensures date exists in array. */
function isValidDate(dateString: string, dateArr?: string[]) {
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateString)) return false;

  const date = parseISO(dateString);
  if (!isValid(date)) return false;

  return dateArr ? dateArr.includes(dateString) : true;
}

/** Add n months to a YYYY-MM-DD date string using date-fns. */
function addMonthsStr(dateStr: string, n: number): string {
  return format(addMonths(parseISO(dateStr), n), "yyyy-MM-dd");
}

/** Add n days to a YYYY-MM-DD date string. */
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Calendar days from `b` to `a` (a - b), as an integer. */
function daysBetweenStr(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

/**
 * Format a UTC date/string as an HST timestamp with relative day labels.
 * Returns "Today, HH:mm", "Yesterday, HH:mm", or "yyyy/MM/dd, HH:mm".
 */
function formatHstTimestamp(dateInput: Date | string | null): string {
  if (!dateInput) return "-";
  const utc = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(utc.getTime())) return "-";
  // Shift to HST (UTC-10, no DST) so date-fns compares against local "today"
  const hst = new Date(utc.getTime() - 10 * 60 * 60 * 1000);
  const time = format(hst, "HH:mm");
  if (isToday(hst)) return `Today, ${time}`;
  if (isYesterday(hst)) return `Yesterday, ${time}`;
  return `${format(hst, "yyyy/MM/dd")}, ${time}`;
}

export {
  generateDates,
  isoDate,
  utcDay,
  freqDate,
  uheroDate,
  dpAgeCode,
  formatRuntime,
  formatHstTimestamp,
  dateTimestamp,
  isValidDate,
  addMonthsStr,
  addDaysStr,
  daysBetweenStr,
};
