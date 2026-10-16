/**
 * Framework checks every extract goes through after parse. Hard failures
 * can never be published; soft ones (disappeared series, large jumps) can
 * be accepted. A source's own checks come back from parse() and are
 * recorded alongside these.
 *
 * Per-extractor settings live in data_extractors.config.checks:
 *   { allowDisappeared?: boolean,   // skip the disappeared-series check
 *     maxChange?: number,           // flag |new/old - 1| above this (e.g. 0.5)
 *     minDate?: "YYYY-MM-DD",       // default 1800-01-01
 *     maxDate?: "YYYY-MM-DD" }      // default two years from today
 */

import type { ExtractIndex } from "./extract-file";
import { seriesKey } from "./extract-file";
import type { ExtractRow, ValidationResult } from "./types";

export type CheckConfig = {
  allowDisappeared?: boolean;
  maxChange?: number;
  minDate?: string;
  maxDate?: string;
};

const SAMPLE = 20;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function checkConfig(config: Record<string, unknown>): CheckConfig {
  const c = (config.checks ?? {}) as Record<string, unknown>;
  return {
    allowDisappeared: c.allowDisappeared === true,
    maxChange:
      typeof c.maxChange === "number" && c.maxChange > 0
        ? c.maxChange
        : undefined,
    minDate: typeof c.minDate === "string" ? c.minDate : undefined,
    maxDate: typeof c.maxDate === "string" ? c.maxDate : undefined,
  };
}

function isRealDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return (
    d.getUTCFullYear() === +m[1] &&
    d.getUTCMonth() === +m[2] - 1 &&
    d.getUTCDate() === +m[3]
  );
}

function result(
  check: string,
  severity: "hard" | "soft",
  failures: unknown[],
  okMessage: string,
  failMessage: (n: number) => string,
): ValidationResult {
  return failures.length === 0
    ? { check, severity, passed: true, message: okMessage }
    : {
        check,
        severity,
        passed: false,
        message: failMessage(failures.length),
        details: failures.slice(0, SAMPLE),
      };
}

const label = (dims: readonly string[], v: Record<string, string>) =>
  dims.map((d) => v[d]).join(" / ");

export function validateExtract(
  rows: readonly ExtractRow[],
  opts: {
    dims: readonly string[];
    config: CheckConfig;
    /** The extractor's last ok output, for the comparison checks */
    previous: ExtractIndex | null;
    /** YYYY-MM-DD; injectable for tests */
    today?: string;
  },
): ValidationResult[] {
  const { dims, config, previous } = opts;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const minDate = config.minDate ?? "1800-01-01";
  const maxDate =
    config.maxDate ?? `${Number(today.slice(0, 4)) + 2}${today.slice(4)}`;
  const out: ValidationResult[] = [];

  out.push(
    result(
      "not_empty",
      "hard",
      rows.length === 0 ? ["no rows"] : [],
      `${rows.length} rows`,
      () => "the parse produced no rows",
    ),
  );

  // columns: exactly the declared dimensions, none blank
  const declared = new Set(dims);
  const badColumns: string[] = [];
  for (const r of rows) {
    const keys = Object.keys(r.dims);
    const extra = keys.filter((k) => !declared.has(k));
    const missing = dims.filter((d) => !(d in r.dims));
    const blank = dims.filter((d) => d in r.dims && !r.dims[d]);
    if (extra.length || missing.length || blank.length) {
      badColumns.push(
        [
          extra.length ? `extra ${extra.join(", ")}` : "",
          missing.length ? `missing ${missing.join(", ")}` : "",
          blank.length ? `blank ${blank.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("; ") + ` (${r.date})`,
      );
    }
  }
  out.push(
    result(
      "columns",
      "hard",
      badColumns,
      `columns are ${dims.join(", ")}`,
      (n) =>
        `${n} row(s) do not match the declared dimensions (${dims.join(", ")})`,
    ),
  );

  const badDates: string[] = [];
  const badValues: string[] = [];
  const seen = new Map<string, number>();
  const dupes: string[] = [];
  for (const r of rows) {
    if (!isRealDate(r.date) || r.date < minDate || r.date > maxDate) {
      badDates.push(`${label(dims, r.dims)}: ${r.date}`);
    }
    if (typeof r.value !== "number" || !Number.isFinite(r.value)) {
      badValues.push(`${label(dims, r.dims)} ${r.date}: ${String(r.value)}`);
    }
    const k = `${seriesKey(dims, r.dims)}\u001e${r.date}`;
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n === 2) dupes.push(`${label(dims, r.dims)} ${r.date}`);
  }
  out.push(
    result(
      "dates",
      "hard",
      badDates,
      `dates fall in ${minDate}..${maxDate}`,
      (n) =>
        `${n} row(s) with a bad or implausible date (allowed ${minDate}..${maxDate})`,
    ),
  );
  out.push(
    result(
      "values",
      "hard",
      badValues,
      "all values numeric",
      (n) => `${n} row(s) with a non-numeric value`,
    ),
  );
  out.push(
    result(
      "duplicates",
      "hard",
      dupes,
      "no duplicate (series, date)",
      (n) => `${n} duplicate (series, date) pair(s)`,
    ),
  );

  if (previous) {
    // the comparison only means something when the dimensions are the same
    const sameDims =
      previous.dims.length === dims.length &&
      previous.dims.every((d, i) => d === dims[i]);
    const current = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const k = seriesKey(dims, r.dims);
      let m = current.get(k);
      if (!m) current.set(k, (m = new Map()));
      m.set(r.date, r.value);
    }

    if (!config.allowDisappeared) {
      const gone = sameDims
        ? [...previous.series.entries()]
            .filter(([k]) => !current.has(k))
            .map(([, s]) => label(previous.dims, s.dims))
        : [
            `dimensions changed: ${previous.dims.join(", ")} → ${dims.join(", ")}`,
          ];
      out.push(
        result(
          "disappeared",
          "soft",
          gone,
          "every series of the previous output is still present",
          (n) =>
            sameDims
              ? `${n} series of the previous output disappeared (relabeled or dropped by the source?)`
              : "the declared dimensions changed since the previous output",
        ),
      );
    }

    if (config.maxChange !== undefined && sameDims) {
      const jumps: string[] = [];
      for (const [k, s] of previous.series) {
        const now = current.get(k);
        if (!now) continue;
        for (const [date, old] of s.data) {
          const v = now.get(date);
          if (v === undefined || old === v) continue;
          const rel = old === 0 ? Infinity : Math.abs(v / old - 1);
          if (rel > config.maxChange) {
            jumps.push(`${label(dims, s.dims)} ${date}: ${old} → ${v}`);
          }
        }
      }
      out.push(
        result(
          "changes",
          "soft",
          jumps,
          `no revision above ${config.maxChange * 100}%`,
          (n) =>
            `${n} value(s) changed by more than ${config.maxChange! * 100}% from the previous output`,
        ),
      );
    }
  }
  return out;
}

/** One-line summary of the failed checks, hard first, for run.error. */
export function failureSummary(results: readonly ValidationResult[]): string {
  return results
    .filter((r) => !r.passed)
    .sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === "hard" ? -1 : 1,
    )
    .map((r) => `[${r.severity}] ${r.check}: ${r.message}`)
    .join(" | ");
}
