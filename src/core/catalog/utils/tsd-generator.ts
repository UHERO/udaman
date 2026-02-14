/**
 * TSD (AREMOS Time Series Data) generator.
 * Ports Rails Series#to_tsd + helpers.
 *
 * TSD is a fixed-width text format:
 *   Line 1: 16-char series name + 64-char description (80 chars)
 *   Line 2: metadata (last-modified, start/end dates, frequency code, day switches)
 *   Data:   5 values per line in scientific notation, 15 chars each, right-justified
 */

import { addDays, addMonths, addWeeks, addYears } from "date-fns";

type TsdFrequency = "year" | "semi" | "quarter" | "month" | "week" | "day";

const FREQUENCY_CODES: Record<TsdFrequency, string> = {
  year: "A",
  semi: "S",
  quarter: "Q",
  month: "M",
  week: "W",
  day: "D",
};

/** Convert a frequency string to its TSD single-character code */
function frequencyCode(freq: TsdFrequency): string {
  return FREQUENCY_CODES[freq] ?? "M";
}

/**
 * Format a date as an 8-character TSD date string.
 * Annual: YYYY0100, Semi: YYYYSS00, Quarter: YYYYQQ00,
 * Monthly: YYYYMM00, Weekly/Daily: YYYYMMDD
 */
function tsdDateString(date: Date, frequency: TsdFrequency): string {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = date.getMonth() + 1;

  switch (frequency) {
    case "year":
      return `${year}0100`;
    case "semi": {
      const semester = month <= 6 ? 1 : 2;
      return `${year}${semester.toString().padStart(2, "0")}00`;
    }
    case "quarter": {
      const quarter = Math.ceil(month / 3);
      return `${year}${quarter.toString().padStart(2, "0")}00`;
    }
    case "month":
      return `${year}${month.toString().padStart(2, "0")}00`;
    case "week":
    case "day": {
      const day = date.getDate();
      return `${year}${month.toString().padStart(2, "0")}${day.toString().padStart(2, "0")}`;
    }
  }
}

/** Generate an array of dates from start to end at the given frequency */
function tsdDateRange(
  startDate: Date,
  endDate: Date,
  frequency: TsdFrequency,
): Date[] {
  const dates: Date[] = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    dates.push(new Date(current));
    switch (frequency) {
      case "year":
        current = addYears(current, 1);
        break;
      case "semi":
        current = addMonths(current, 6);
        break;
      case "quarter":
        current = addMonths(current, 3);
        break;
      case "month":
        current = addMonths(current, 1);
        break;
      case "week":
        current = addWeeks(current, 1);
        break;
      case "day":
        current = addDays(current, 1);
        break;
    }
  }

  return dates;
}

/**
 * Format a number in AREMOS scientific notation.
 * Ruby equivalent: `('%.6E' % value).insert(-3, '00')`
 * Result: "1.234560E+0002" (14 chars for positive values)
 */
function tsdScientific(value: number): string {
  const sci = value.toExponential(6).toUpperCase();
  const eIdx = sci.indexOf("E");
  const sign = sci[eIdx + 1]; // + or -
  const exp = sci.slice(eIdx + 2).padStart(2, "0");
  return `${sci.slice(0, eIdx)}E${sign}00${exp}`;
}

/** AREMOS sentinel for missing/null data points */
const TSD_NULL = "1.000000E+0015";

interface TsdSeriesInput {
  name: string;
  description?: string;
  data: Map<string, number>;
  frequency: TsdFrequency;
}

/** Format a date as yyyy-MM-dd to match DataFileReader date keys */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

/** Generate TSD output for a single series */
function seriesToTsd(input: TsdSeriesInput): string {
  const { name, description = "", data, frequency } = input;

  if (data.size === 0) return "";

  const sortedDates = [...data.keys()].sort();
  const startDate = new Date(sortedDates[0]);
  const endDate = new Date(sortedDates[sortedDates.length - 1]);

  // Strip frequency suffix from name (e.g. "E_NF@HI.M" -> "E_NF@HI")
  const nameNoFreq = name.includes(".") ? name.split(".")[0] : name;

  const lm = new Date();

  // Day switches (17 chars)
  let daySwitches: string;
  if (frequency === "week") {
    const chars = "0         0000000".split("");
    chars[10 + startDate.getDay()] = "1";
    daySwitches = chars.join("");
  } else if (frequency === "day") {
    daySwitches = "0         1111111";
  } else {
    daySwitches = "0                ";
  }

  // Line 1: name (16) + description (64) = 80 chars
  const line1 =
    nameNoFreq.padEnd(16).slice(0, 16) +
    description.padEnd(64).slice(0, 64) +
    "\r\n";

  // Line 2: metadata (80 chars)
  // Format: month.rjust(34) + "/" + day.rjust(2) + "/" + yearShort + "0800" + start(8) + end(8) + freq(1) + "  " + daySwitches(17)
  const monthStr = (lm.getMonth() + 1).toString().padStart(34, " ");
  const dayStr = lm.getDate().toString().padStart(2, " ");
  const yearStr = lm.getFullYear().toString().slice(2);
  const line2 =
    `${monthStr}/${dayStr}/${yearStr}` +
    "0800" +
    tsdDateString(startDate, frequency) +
    tsdDateString(endDate, frequency) +
    frequencyCode(frequency) +
    "  " +
    daySwitches +
    "\r\n";

  // Build scientific notation lookup
  const sciData = new Map<string, string>();
  for (const [date, value] of data) {
    sciData.set(date, tsdScientific(value));
  }

  // Data lines: 5 values per line, each right-justified to 15 chars
  const dateRange = tsdDateRange(startDate, endDate, frequency);
  let dataOutput = "";

  dateRange.forEach((date, i) => {
    const value = sciData.get(dateKey(date)) ?? TSD_NULL;
    dataOutput += value.padStart(15, " ");

    if ((i + 1) % 5 === 0) {
      dataOutput += "     \r\n";
    }
  });

  // Pad final incomplete line to 80 chars
  if (!dataOutput.endsWith("\r\n")) {
    const lastLineStart = dataOutput.lastIndexOf("\r\n");
    const lastLine =
      lastLineStart === -1 ? dataOutput : dataOutput.slice(lastLineStart + 2);
    const padding = 80 - lastLine.length;
    if (padding > 0) {
      dataOutput += " ".repeat(padding) + "\r\n";
    }
  }

  return line1 + line2 + dataOutput;
}

/** Generate TSD output for multiple series */
function generateTsd(series: TsdSeriesInput[]): string {
  let output = "";
  for (const s of series) {
    output += seriesToTsd(s);
  }
  return output;
}

export { generateTsd, seriesToTsd, tsdScientific, tsdDateString, tsdDateRange };
export type { TsdSeriesInput, TsdFrequency };
