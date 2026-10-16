/**
 * Extract DOTAX report files into (type, tax, source, area, date, value).
 *
 * Inputs are the stored current-page XLSX files and archive zips of both
 * DOTAX downloaders (parse-files.ts). One file per (report, month) is
 * used: the source (a current-page URL or a zip) with the newest file date
 * wins, then the highest revision marker, then the newest file —
 * dotax.R's inventory. Each file is read by the report parsers ported
 * from dotax_parse.R (parse-reports.ts).
 *
 * Labels: every spelling a row has been printed with resolves to one item
 * through the label rules (config/labels), and the item is printed under
 * its fixed label (config/canonical). A spelling no rule recognizes is an
 * `unknown_label` failure; an item with no fixed label is a soft
 * `new_label` failure.
 *
 * Checks (checks.ts): districts add up to the state, components to
 * totals, every month between a report's first and last file has a file;
 * known DOTAX file errors are waived (config/known-issues).
 *
 * Missing periods: every month between a series' first and last value
 * that has no value is classified — blank (printed with no value), absent
 * (the month's file was read but has no such row) or failed (the month's
 * file could not be read and a known issue waived it; unwaived read
 * failures fail the run). They are written next to the extract.
 */

import type {
  ExtractRow,
  MissingPeriod,
  ParseInput,
  ParseResult,
  ValidationResult,
} from "../../types";
import { applyKnown, validate, waiverFor } from "./checks";
import { monthRange } from "./dates";
import { dotaxDisplay, fixedLabel, reportKey } from "./labels";
import { inventory, pickPerMonth } from "./parse-files";
import { parseFile, Problems } from "./parse-reports";
import type { ParsedRow, Problem } from "./parse-reports";

export const DOTAX_DIMS = ["type", "tax", "source", "area"] as const;

/** Checks whose failure can be accepted (a new row, not wrong data). */
const SOFT_CHECKS = new Set(["new_label"]);

/** Problems meaning a report-month could not be read (its values are unknown). */
const READ_FAILURES = new Set([
  "missing_file",
  "parse_error",
  "unreadable",
  "header_month",
  "no_data",
  "no_table",
  "no_allocation_table",
  "section",
]);

type Dims = Record<(typeof DOTAX_DIMS)[number], string>;

/**
 * Classify the months inside each series' range that have no value.
 * `readFailures` maps type|month → what could not be read there.
 */
export function missingPeriods(
  parsed: readonly ParsedRow[],
  printed: ReadonlyMap<string, Dims>,
  reportMonths: ReadonlyMap<string, string[]>,
  readFailures: ReadonlyMap<string, string>,
): MissingPeriod[] {
  const byKey = new Map<string, Map<string, ParsedRow>>();
  for (const r of parsed) {
    const k = reportKey(r.type, r.section, r.sub, r.item, r.geo);
    const months = byKey.get(k) ?? byKey.set(k, new Map()).get(k)!;
    const prev = months.get(r.month);
    // a value wins over a blank printing of the same row
    if (!prev || (prev.value === null && r.value !== null)) {
      months.set(r.month, r);
    }
  }
  const out: MissingPeriod[] = [];
  for (const [k, months] of byKey) {
    const dims = printed.get(k);
    if (!dims) continue;
    const withValue = [...months.values()]
      .filter((r) => r.value !== null)
      .map((r) => r.month)
      .sort();
    const first = withValue[0];
    const last = withValue[withValue.length - 1];
    const type = k.split("|")[0];
    for (const mo of reportMonths.get(type) ?? []) {
      if (mo <= first || mo >= last) continue;
      const row = months.get(mo);
      if (row && row.value !== null) continue;
      const date = `${mo}-01`;
      if (row) {
        out.push({ dims, date, reason: "blank" });
        continue;
      }
      const failure = readFailures.get(`${type}|${mo}`);
      if (failure) {
        out.push({ dims, date, reason: "failed", detail: failure });
        continue;
      }
      const note = waiverFor({
        type,
        month: mo,
        check: "series_gap",
        detail: k,
        file: "",
      })?.note;
      out.push({
        dims,
        date,
        reason: "absent",
        ...(note ? { detail: note } : {}),
      });
    }
  }
  return out;
}

function toResults(
  open: Problem[],
  waived: Array<Problem & { note: string }>,
  names: Map<string, string>,
): ValidationResult[] {
  const byCheck = new Map<string, Problem[]>();
  for (const p of open) {
    (byCheck.get(p.check) ?? byCheck.set(p.check, []).get(p.check)!).push(p);
  }
  const line = (p: Problem) =>
    `${p.type} ${p.month}: ${p.detail}${p.file ? ` (${names.get(p.file) ?? p.file})` : ""}`;
  const out: ValidationResult[] = [];
  for (const [check, list] of byCheck) {
    out.push({
      check: `dotax:${check}`,
      severity: SOFT_CHECKS.has(check) ? "soft" : "hard",
      passed: false,
      message: `${list.length} problem(s), e.g. ${line(list[0])}`,
      details: list.slice(0, 20).map(line),
    });
  }
  out.push({
    check: "dotax:waived",
    severity: "soft",
    passed: true,
    message: `${waived.length} known DOTAX file issue(s) waived (config/known-issues)`,
    ...(waived.length
      ? { details: waived.slice(0, 20).map((p) => `${line(p)} — ${p.note}`) }
      : {}),
  });
  if (byCheck.size === 0) {
    out.push({
      check: "dotax:checks",
      severity: "hard",
      passed: true,
      message: "district sums, totals, labels and file coverage check out",
    });
  }
  return out;
}

export function parseDotaxReports(
  inputs: readonly ParseInput[],
  log: (msg: string) => void,
): ParseResult {
  const { files, names, skipped } = inventory(inputs);
  const picked = pickPerMonth(files);
  const problems = new Problems();

  // every month between a report's first and last file must have a file
  const reportMonths = new Map<string, string[]>();
  const byType = new Map<string, Set<string>>();
  for (const f of picked) {
    (byType.get(f.type) ?? byType.set(f.type, new Set()).get(f.type)!).add(
      f.month,
    );
  }
  for (const [type, months] of byType) {
    const sorted = [...months].sort();
    const range = monthRange(sorted[0], sorted[sorted.length - 1]);
    reportMonths.set(type, range);
    for (const mo of range) {
      if (!months.has(mo)) {
        problems.add(type, mo, "missing_file", "no file for this month");
      }
    }
  }

  const parsed: ParsedRow[] = [];
  for (const [i, f] of picked.entries()) {
    parsed.push(...parseFile(f.type, f.path, f.month, problems));
    if ((i + 1) % 100 === 0) log(`parsed ${i + 1}/${picked.length} files`);
  }
  validate(parsed, problems);

  // one fixed label per series; two series must not print the same
  const latest = new Map<string, ParsedRow>();
  for (const r of parsed) {
    if (r.value === null) continue;
    const key = reportKey(r.type, r.section, r.sub, r.item, r.geo);
    const prev = latest.get(key);
    if (!prev || r.month > prev.month) latest.set(key, r);
  }
  const printed = new Map<string, Dims>();
  const owner = new Map<string, string>();
  const newLabels = new Map<string, string>();
  for (const [key, r] of latest) {
    const fixed = fixedLabel(r.type, r.section, r.sub, r.item);
    if (fixed === null) {
      newLabels.set(`${r.type}|${r.section}|${r.sub}|${r.item}`, r.label);
    }
    const d = dotaxDisplay(r, fixed ?? r.label);
    const dims: Dims = {
      type: r.type,
      tax: d.tax,
      source: d.source,
      area: d.area,
    };
    const printedKey = Object.values(dims).join("\u001f");
    const other = owner.get(printedKey);
    if (other) {
      problems.add(
        r.type,
        r.month,
        "output_label",
        `${Object.values(dims).join(" / ")} is printed for both ${other} and ${key}`,
        r.file,
      );
      continue;
    }
    owner.set(printedKey, key);
    printed.set(key, dims);
  }
  for (const [item, label] of newLabels) {
    problems.add(
      item.split("|")[0],
      "",
      "new_label",
      `${item} has no fixed label (printed as "${label}"); add it to config/canonical.ts`,
    );
  }

  const { open, waived } = applyKnown(problems.list);
  const readFailures = new Map<string, string>();
  for (const p of [...open, ...waived]) {
    if (!READ_FAILURES.has(p.check)) continue;
    const note = "note" in p ? ` (waived: ${p.note})` : "";
    readFailures.set(`${p.type}|${p.month}`, `${p.check}: ${p.detail}${note}`);
  }

  const rows: ExtractRow[] = [];
  const seen = new Set<string>();
  for (const r of parsed) {
    if (r.value === null) continue;
    const key = reportKey(r.type, r.section, r.sub, r.item, r.geo);
    const dims = printed.get(key);
    if (!dims) continue;
    const date = `${r.month}-01`;
    if (seen.has(`${key}\r${date}`)) continue;
    seen.add(`${key}\r${date}`);
    rows.push({ dims, date, value: r.value });
  }

  const months = picked.map((f) => f.month).sort();
  return {
    rows,
    missing: missingPeriods(parsed, printed, reportMonths, readFailures),
    checks: toResults(open, waived, names),
    stats: {
      filesStored: inputs.length,
      reportFiles: files.length,
      filesUsed: picked.length,
      firstMonth: months[0] ?? null,
      lastMonth: months[months.length - 1] ?? null,
      problemsOpen: open.length,
      problemsWaived: waived.length,
      ...(skipped.length ? { notReports: skipped.slice(0, 50) } : {}),
    },
  };
}
