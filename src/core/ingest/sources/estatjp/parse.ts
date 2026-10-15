/**
 * Extract e-Stat series from the newest vintage of each key. Only monthly
 * time codes are kept ("YYYY00MMMM": 2024000101 = Jan 2024); annual,
 * fiscal-year and quarterly codes are skipped. A value that is not a
 * number (the table's NOTE characters: "***", "…", "-") has no row and,
 * inside the series' range, is a blank missing period with the note.
 */

import { readFileSync } from "node:fs";

import type {
  ExtractRow,
  MissingPeriod,
  ParseInput,
  ParseResult,
  ValidationResult,
} from "../../types";
import type { EstatSeriesFile } from "./fetch";

const MONTHLY = /^(\d{4})00(0[1-9]|1[0-2])\2$/;

/** e-Stat time code → YYYY-MM-01 for a month, else null. */
export function estatMonth(time: string): string | null {
  const m = MONTHLY.exec(time);
  return m ? `${m[1]}-${m[2]}-01` : null;
}

export function parseEstat(
  inputs: readonly ParseInput[],
  classes: readonly string[],
): ParseResult {
  const rows: ExtractRow[] = [];
  const missing: MissingPeriod[] = [];
  const undeclared = new Set<string>();
  for (const input of inputs) {
    const raw = JSON.parse(readFileSync(input.path, "utf8")) as EstatSeriesFile;
    if (!raw.statsDataId || !raw.codes) {
      throw new Error(
        `${input.artifact.artifactKey}: not an e-Stat series file`,
      );
    }
    for (const k of Object.keys(raw.codes)) {
      if (!classes.includes(k)) undeclared.add(`${raw.statsDataId} ${k}`);
    }
    const dims: Record<string, string> = { stats_data_id: raw.statsDataId };
    for (const c of classes) dims[c] = raw.codes[c] ?? "-";
    const notes = new Map(raw.notes.map((n) => [n.char, n.text]));
    const points = raw.values
      .map((v) => {
        const date = estatMonth(v.time);
        const text = v.value.trim();
        const n = Number(text.replace(/,/g, ""));
        return {
          date,
          text,
          value: text !== "" && Number.isFinite(n) ? n : null,
        };
      })
      .filter((p): p is typeof p & { date: string } => p.date !== null);
    const dated = points
      .filter((p) => p.value !== null)
      .map((p) => p.date)
      .sort();
    for (const p of points) {
      if (p.value !== null) rows.push({ dims, date: p.date, value: p.value });
      else if (p.date > dated[0] && p.date < dated[dated.length - 1]) {
        const note = notes.get(p.text);
        missing.push({
          dims,
          date: p.date,
          reason: "blank",
          detail: note ? `${p.text}: ${note}` : p.text,
        });
      }
    }
  }
  const checks: ValidationResult[] = [
    {
      check: "estat_classes",
      severity: "hard",
      passed: undeclared.size === 0,
      message: undeclared.size
        ? `classifications not among the extractor's dimensions (add them to config.classes): ${[...undeclared].join(", ")}`
        : "every classification is a dimension",
      details: [...undeclared].slice(0, 20),
    },
  ];
  return { rows, missing, checks, stats: { series: inputs.length } };
}
