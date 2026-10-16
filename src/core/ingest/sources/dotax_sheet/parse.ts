/**
 * Extract the sheet: long format, one row per (month, type, tax, source),
 * columns found by header (date (yyyy-mm-dd) | type | tax | source |
 * amount, or the original Date | Source Type | Tax Type | Source | Amount).
 * The sheet is kept by hand and consistent, so labels print as written in
 * the latest month; case and spacing differences are the same series. A
 * source with two amounts for one month is a hard failure; a date cell
 * that is neither a date nor yyyy-mm-dd text fails the parse.
 */

import { readFileSync } from "node:fs";

import type {
  ExtractRow,
  ParseInput,
  ParseResult,
  ValidationResult,
} from "../../types";

/** Accepted header text per column (lowercased, "(...)" dropped). */
const HEADERS = {
  date: ["date"],
  type: ["type", "source type"],
  tax: ["tax", "tax type"],
  source: ["source"],
  amount: ["amount"],
} as const;
type Column = keyof typeof HEADERS;
const REQUIRED: Column[] = ["date", "type", "tax", "source", "amount"];

const norm = (v: unknown) =>
  String(v ?? "")
    .replace(/[‘’ʻ]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const headerName = (v: unknown) =>
  norm(String(v ?? "").replace(/\(.*?\)/g, ""));

/** Sheets serial day number → YYYY-MM-01. */
function serialToMonth(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400000));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** A date cell → YYYY-MM-01: a real date, or text written yyyy-mm-dd. */
export function cellMonth(v: unknown): string | null {
  if (typeof v === "number") return serialToMonth(v);
  const m = String(v ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})(-\d{2})?$/);
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12
    ? `${m[1]}-${m[2]}-01`
    : null;
}

export function parseSheetValues(values: unknown[][]): {
  rows: ExtractRow[];
  checks: ValidationResult[];
  stats: Record<string, unknown>;
} {
  const header = (values[0] ?? []).map(headerName);
  const col = {} as Record<Column, number>;
  for (const [name, accepted] of Object.entries(HEADERS) as Array<
    [Column, readonly string[]]
  >) {
    col[name] = header.findIndex((h) => accepted.includes(h));
  }
  const missing = REQUIRED.filter((c) => col[c] < 0);
  if (missing.length) {
    throw new Error(
      `no ${missing.join(", ")} column - expected headers date (yyyy-mm-dd) | type | tax | source | amount, got ${(values[0] ?? []).join(" | ")}`,
    );
  }

  const blank = (v: unknown) => v === undefined || v === null || v === "";
  const badDates: number[] = [];
  const series = new Map<
    string,
    { label: string[]; latest: string; obs: Map<string, number> }
  >();
  const conflicts = new Map<string, string>();
  let latest = "";
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const cell = (c: Column) => row[col[c]];
    const [date, type, tax, source, amount] = REQUIRED.map(cell);
    if (blank(date) && blank(type) && blank(source)) continue;
    const month = cellMonth(date);
    if (!month) {
      badDates.push(i + 1);
      continue;
    }
    if (blank(amount)) continue; // months not filled in yet
    const value =
      typeof amount === "number"
        ? amount
        : Number(String(amount).replace(/[,$\s]/g, ""));
    if (!Number.isFinite(value)) continue;
    const key = [type, tax, source].map(norm).join("\u001f");
    if (month > latest) latest = month;
    const s = series.get(key) ?? { label: [], latest: "", obs: new Map() };
    if (month >= s.latest) {
      s.latest = month;
      s.label = [type, tax, source].map((v) => String(v ?? "").trim());
    }
    const prev = s.obs.get(month);
    if (prev !== undefined && prev !== value) {
      conflicts.set(
        key,
        `${s.label.join(" / ")} ${month}: ${prev} vs ${value}`,
      );
    }
    s.obs.set(month, value);
    series.set(key, s);
  }
  if (badDates.length) {
    throw new Error(
      `not able to parse the date in row(s) ${badDates.slice(0, 10).join(", ")}${badDates.length > 10 ? ` (+${badDates.length - 10} more)` : ""} - date cells must be real dates or yyyy-mm-dd text`,
    );
  }

  const rows: ExtractRow[] = [];
  for (const s of series.values()) {
    const [type, tax, source] = s.label;
    for (const [date, value] of s.obs) {
      rows.push({ dims: { type, tax, source }, date, value });
    }
  }
  const checks: ValidationResult[] = [
    conflicts.size
      ? {
          check: "sheet:conflicts",
          severity: "hard",
          passed: false,
          message: `${conflicts.size} source(s) have two different amounts for one month`,
          details: [...conflicts.values()].slice(0, 20),
        }
      : {
          check: "sheet:conflicts",
          severity: "hard",
          passed: true,
          message: "one amount per source and month",
        },
  ];
  return { rows, checks, stats: { sources: series.size, latestMonth: latest } };
}

export function parseSheet(inputs: readonly ParseInput[]): ParseResult {
  if (inputs.length !== 1) {
    throw new Error(`expected one stored sheet, got ${inputs.length}`);
  }
  const json = JSON.parse(readFileSync(inputs[0].path, "utf8")) as {
    values?: unknown[][];
  };
  return parseSheetValues(json.values ?? []);
}
