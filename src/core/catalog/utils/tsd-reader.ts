/**
 * TSD (AREMOS Time Series Data) reader/parser.
 * Ports Rails TsdFile parsing logic.
 *
 * TSD is a fixed-width text format:
 *   Line 1: 16-char series name + 64-char description (80 chars)
 *   Line 2: metadata (last-modified date, start/end dates, frequency code, day switches)
 *   Data:   5 values per line, each 15 chars wide, scientific notation
 *
 * Missing sentinel: 1.000000E+0015 → null
 */

export type TsdFrequencyCode = "A" | "S" | "Q" | "M" | "W" | "D";

export interface TsdSeries {
  name: string;
  description: string;
  frequency: TsdFrequencyCode;
  startDate: string; // raw 8-char AREMOS date
  endDate: string; // raw 8-char AREMOS date
  dataHash: Map<string, number | null>;
}

const MISSING_SENTINEL = 1e15;

/** Parse a TSD file's text content into an array of series */
export function parseTsdContent(text: string): TsdSeries[] {
  const series: TsdSeries[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.trim() === "") {
      i++;
      continue;
    }

    // Detect name line: contains '@'
    if (!line.includes("@")) {
      i++;
      continue;
    }

    // Line 1: name (16 chars) + description (rest)
    const name = line.substring(0, 16).trim();
    const description = line.substring(16).trim();
    i++;

    if (i >= lines.length) break;

    // Line 2: details — start(8) at pos 44-51, end(8) at pos 52-59, freq(1) at pos 60
    const detailsLine = lines[i];
    const startDate = detailsLine.substring(44, 52);
    const endDate = detailsLine.substring(52, 60);
    const frequency = detailsLine.substring(60, 61) as TsdFrequencyCode;
    i++;

    // Data lines: each line has up to 5 values, each 15 chars wide
    const rawValues: string[] = [];
    while (i < lines.length) {
      const dataLine = lines[i];
      if (!dataLine || dataLine.trim() === "") {
        i++;
        break;
      }
      // Check if this is the next name line (contains '@')
      if (dataLine.includes("@")) break;
      // Check if this looks like a data line (contains '.')
      if (!dataLine.includes(".")) {
        i++;
        break;
      }

      // Read exactly-15-char chunks (matches Ruby's line.scan(/.{15}/))
      // Trailing partial content (<15 chars of padding) is discarded.
      const chunks = dataLine.match(/.{15}/g) || [];
      for (const chunk of chunks) {
        rawValues.push(chunk);
      }
      i++;
    }

    const dataHash = parseData(rawValues, startDate, frequency);
    series.push({ name, description, frequency, startDate, endDate, dataHash });
  }

  return series;
}

/** Parse raw data values into a date→value map based on frequency */
function parseData(
  data: string[],
  startDateStr: string,
  frequency: TsdFrequencyCode,
): Map<string, number | null> {
  switch (frequency) {
    case "A":
      return parseAnnualData(data, startDateStr);
    case "S":
      return parseSemiAnnualData(data, startDateStr);
    case "Q":
      return parseQuarterlyData(data, startDateStr);
    case "M":
      return parseMonthlyData(data, startDateStr);
    case "W":
      return parseWeeklyData(data, startDateStr);
    case "D":
      return parseDailyData(data, startDateStr);
    default:
      throw new Error(`TSD parseData: unknown frequency ${frequency}`);
  }
}

function parseValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const val = parseFloat(trimmed);
  if (isNaN(val)) return null;
  // Check for missing sentinel (1E+15)
  if (Math.abs(val) >= MISSING_SENTINEL) return null;
  return val;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseAnnualData(
  data: string[],
  startDateStr: string,
): Map<string, number | null> {
  const hash = new Map<string, number | null>();
  let year = parseInt(startDateStr.substring(0, 4), 10);
  for (const raw of data) {
    const value = parseValue(raw);
    if (value === null && !raw.trim()) break;
    hash.set(`${year}-01-01`, value);
    year++;
  }
  return hash;
}

function parseSemiAnnualData(
  data: string[],
  startDateStr: string,
): Map<string, number | null> {
  const hash = new Map<string, number | null>();
  let year = parseInt(startDateStr.substring(0, 4), 10);
  let semi = parseInt(startDateStr.substring(4, 6), 10);
  const semiMonths = ["01", "07"];
  for (const raw of data) {
    const value = parseValue(raw);
    if (value === null && !raw.trim()) break;
    hash.set(`${year}-${semiMonths[semi - 1]}-01`, value);
    semi++;
    if (semi > 2) {
      semi = 1;
      year++;
    }
  }
  return hash;
}

function parseQuarterlyData(
  data: string[],
  startDateStr: string,
): Map<string, number | null> {
  const hash = new Map<string, number | null>();
  let year = parseInt(startDateStr.substring(0, 4), 10);
  let quarter = parseInt(startDateStr.substring(4, 6), 10);
  const quarterMonths = ["01", "04", "07", "10"];
  for (const raw of data) {
    const value = parseValue(raw);
    if (value === null && !raw.trim()) break;
    hash.set(`${year}-${quarterMonths[quarter - 1]}-01`, value);
    quarter++;
    if (quarter > 4) {
      quarter = 1;
      year++;
    }
  }
  return hash;
}

function parseMonthlyData(
  data: string[],
  startDateStr: string,
): Map<string, number | null> {
  const hash = new Map<string, number | null>();
  let year = parseInt(startDateStr.substring(0, 4), 10);
  let month = parseInt(startDateStr.substring(4, 6), 10);
  for (const raw of data) {
    const value = parseValue(raw);
    if (value === null && !raw.trim()) break;
    hash.set(`${year}-${pad2(month)}-01`, value);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return hash;
}

function parseWeeklyData(
  data: string[],
  startDateStr: string,
): Map<string, number | null> {
  const hash = new Map<string, number | null>();
  const year = parseInt(startDateStr.substring(0, 4), 10);
  const month = parseInt(startDateStr.substring(4, 6), 10);
  const day = parseInt(startDateStr.substring(6, 8), 10) || 1;
  let date = new Date(year, month - 1, day);
  for (const raw of data) {
    const value = parseValue(raw);
    if (value === null && !raw.trim()) break;
    hash.set(dateToStr(date), value);
    date = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return hash;
}

function parseDailyData(
  data: string[],
  startDateStr: string,
): Map<string, number | null> {
  const hash = new Map<string, number | null>();
  const year = parseInt(startDateStr.substring(0, 4), 10);
  const month = parseInt(startDateStr.substring(4, 6), 10);
  const day = parseInt(startDateStr.substring(6, 8), 10) || 1;
  let date = new Date(year, month - 1, day);
  for (const raw of data) {
    const value = parseValue(raw);
    if (value === null && !raw.trim()) break;
    hash.set(dateToStr(date), value);
    date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }
  return hash;
}

function dateToStr(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Get a sorted union of all dates across multiple series */
export function getAllDates(seriesList: TsdSeries[]): string[] {
  const dateSet = new Set<string>();
  for (const s of seriesList) {
    for (const key of s.dataHash.keys()) {
      dateSet.add(key);
    }
  }
  return [...dateSet].sort();
}
