/**
 * Shared by dotax_current and dotax_archive: parse the picked report files,
 * run the consistency checks, apply the known issues, and flatten the
 * parsed rows into the DOTAX output shape (date, type, tax, source, area,
 * amount, fiscal_year — see args.ts).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { KEY_SEP } from "../tidy";
import type { TidyRow } from "../types";
import { dotaxDisplay, dotaxIndexKey, fiscalYear, reportKey } from "./args";
import {
  applyKnown,
  checkGaps,
  fillLegacy,
  mapSeries,
  validate,
} from "./checks";
import { parseFile, Problems } from "./parse";
import type { ParsedRow, Problem } from "./parse";
import { monthRange } from "./site";
import type { InventoryFile } from "./site";

export type ReportBuild = {
  rows: TidyRow[];
  open: Problem[];
  waived: Problem[];
  filesParsed: number;
  months: { first: string | null; last: string | null };
};

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeProblems(
  cacheDir: string,
  open: Problem[],
  waived: Problem[],
) {
  mkdirSync(cacheDir, { recursive: true });
  const lines = ["type,month,check,detail,file,status"];
  for (const [list, status] of [
    [open, "open"],
    [waived, "waived"],
  ] as const) {
    for (const p of list) {
      lines.push(
        [p.type, p.month, p.check, p.detail, p.file, status]
          .map(csvCell)
          .join(","),
      );
    }
  }
  writeFileSync(join(cacheDir, "problems.csv"), lines.join("\n") + "\n");
}

export function buildReport(
  files: InventoryFile[],
  log: (msg: string) => void,
): ReportBuild {
  const problems = new Problems();

  // every month between a report's first and last file must have a file
  const byType = new Map<string, Set<string>>();
  for (const f of files) {
    const s = byType.get(f.type) ?? new Set<string>();
    s.add(f.month);
    byType.set(f.type, s);
  }
  for (const [type, months] of byType) {
    const sorted = [...months].sort();
    for (const mo of monthRange(sorted[0], sorted[sorted.length - 1])) {
      if (!months.has(mo))
        problems.add(type, mo, "missing_file", "no file for this month");
    }
  }

  const parsed: ParsedRow[] = [];
  let n = 0;
  for (const f of files) {
    parsed.push(...parseFile(f.type, f.path, f.month, problems));
    if (++n % 100 === 0) log(`parsed ${n}/${files.length} files`);
  }

  validate(parsed, problems);
  const mapped = fillLegacy(mapSeries(parsed, problems));
  const parsedMonths = [
    ...new Map(
      parsed.map((r) => [
        `${r.type}\r${r.month}`,
        { type: r.type, month: r.month },
      ]),
    ).values(),
  ];
  checkGaps(mapped, parsedMonths, problems);

  // One printed label per series: the latest month's spelling, so a row
  // DOTAX relabelled stays one series in the output.
  const latest = new Map<string, { month: string; row: ParsedRow }>();
  for (const r of parsed) {
    if (r.value === null) continue;
    const key = reportKey(r.type, r.section, r.sub, r.item, r.geo);
    const prev = latest.get(key);
    if (!prev || r.month > prev.month)
      latest.set(key, { month: r.month, row: r });
  }
  const rowKeyOf = new Map<string, string>();
  const ownerOf = new Map<string, string>();
  for (const [key, { month, row }] of latest) {
    const d = dotaxDisplay(row, row.label);
    const rowKey = [row.type, d.tax, d.source, d.area].join(KEY_SEP);
    // the printed columns must lead back to the same series, and no two
    // series may print the same
    const back = dotaxIndexKey(rowKey);
    const other = ownerOf.get(rowKey);
    if (back !== key || other) {
      problems.add(
        row.type,
        month,
        "output_label",
        `${rowKey} ${other ? `is printed for both ${other} and ${key}` : `resolves to ${back ?? "nothing"}, not ${key}`}`,
        row.file,
      );
      continue;
    }
    ownerOf.set(rowKey, key);
    rowKeyOf.set(key, rowKey);
  }

  const { open, waived } = applyKnown(problems.list);

  const rows: TidyRow[] = [];
  const seen = new Set<string>();
  for (const r of parsed) {
    if (r.value === null) continue;
    const rowKey = rowKeyOf.get(
      reportKey(r.type, r.section, r.sub, r.item, r.geo),
    );
    if (!rowKey) continue;
    const date = `${r.month}-01`;
    const k = `${rowKey}\r${date}`;
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({
      key: rowKey,
      date,
      value: r.value,
      extra: { fiscal_year: fiscalYear(r.month) },
    });
  }
  const months = files.map((f) => f.month).sort();
  return {
    rows,
    open,
    waived,
    filesParsed: files.length,
    months: {
      first: months[0] ?? null,
      last: months[months.length - 1] ?? null,
    },
  };
}

/** Problem summary lines for last_error / last_stats. */
export function problemLines(list: Problem[], max = 15): string[] {
  return list
    .slice(0, max)
    .map((p) => `${p.type} ${p.month} ${p.check}: ${p.detail}`);
}

// ─── Source Download naming ─────────────────────────────────────────

/**
 * Source Download handle for one DOTAX file / zip, e.g.
 * DOTAX_CUR_2025-08_202508collec_rev@tax.hawaii.gov. "%" and "@" are kept
 * out (a "%" handle is treated as a date-sensitive pattern elsewhere).
 */
export function sourceHandle(
  kind: "CUR" | "ARC",
  month: string,
  fileName: string,
): string {
  const stem = fileName
    .replace(/\.[A-Za-z0-9]+$/, "")
    .replace(/[^A-Za-z0-9 ._&()-]/g, "_");
  return `DOTAX_${kind}_${month}_${stem}@tax.hawaii.gov`;
}

export function parseSourceHandle(
  handle: string | null,
): { kind: "CUR" | "ARC"; month: string; stem: string } | null {
  const m = (handle ?? "").match(
    /^DOTAX_(CUR|ARC)_(\d{4}-\d{2})_(.+)@tax\.hawaii\.gov$/,
  );
  return m ? { kind: m[1] as "CUR" | "ARC", month: m[2], stem: m[3] } : null;
}

export function fileNameFromUrl(url: string): string {
  return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
}
