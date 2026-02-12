import {
  addMonths,
  addQuarters,
  addYears,
  differenceInDays,
  format,
  fromUnixTime,
  isAfter,
  isValid,
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
  formatString?: string
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
      "generateDates: startDate must be before or equal to endDate"
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
  formatString: string = "yyyy-MM"
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
  formatString: string = "yyyy-'Q'Q"
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
  formatString: string = "yyyy"
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

/** Try to keep display formats consistent across all systems */
const uheroDate = (date: Date, freq?: string) => {
  switch (freq) {
    case "M":
      return format(date, "MMM yyyy");
    case "Q":
      return format(date, "yyyy QQQ");
    case "A":
      return format(date, "yyyy");
    default:
      return format(date, "yyyy-MM-dd");
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
  return format(date, "MMM d, yyyy HH:mm");
}

/** Ensure datestring is in standard yyyy-mm-dd format. If optional array provided, ensures date exists in array. */
function isValidDate(dateString: string, dateArr?: string[]) {
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateString)) return false;

  const date = parseISO(dateString);
  if (!isValid(date)) return false;

  return dateArr ? dateArr.includes(dateString) : true;
}

export {
  generateDates,
  uheroDate,
  dpAgeCode,
  formatRuntime,
  dateTimestamp,
  isValidDate,
};
