/**
 * Extract BEA series from the newest vintage of each key. A point BEA
 * flags — "(NA)", "(D)", "(NM)" … in DataValue or NoteRef, or an empty
 * value — has no row (as load_api_bea) and, inside the series' range, is a
 * blank missing period carrying the flag.
 */

import { readFileSync } from "node:fs";

import { isMissing } from "@catalog/utils/api-clients/bea";
import { grokDate } from "@catalog/utils/api-clients/index";

import type {
  ExtractRow,
  MissingPeriod,
  ParseInput,
  ParseResult,
} from "../../types";
import type { BeaSeriesFile } from "./fetch";

export function parseBea(inputs: readonly ParseInput[]): ParseResult {
  const rows: ExtractRow[] = [];
  const missing: MissingPeriod[] = [];
  for (const input of inputs) {
    const raw = JSON.parse(readFileSync(input.path, "utf8")) as BeaSeriesFile;
    if (!raw.dataset || !raw.table || !raw.line || !raw.frequency) {
      throw new Error(`${input.artifact.artifactKey}: not a BEA series file`);
    }
    const dims = {
      dataset: raw.dataset,
      table: raw.table,
      line: raw.line,
      geo: raw.geo,
      frequency: raw.frequency,
    };
    const points = raw.points.map((p) => {
      const date = grokDate(p.period.slice(0, 4), p.period.slice(4));
      const flagged = isMissing({
        TimePeriod: p.period,
        DataValue: p.value,
        NoteRef: p.noteRef,
      });
      const value = Number(p.value.trim().replace(/,/g, ""));
      if (!flagged && !Number.isFinite(value)) {
        throw new Error(
          `${input.artifact.artifactKey} ${p.period}: unreadable value "${p.value}"`,
        );
      }
      return {
        date,
        value: flagged ? null : value,
        flag: `${p.value} ${p.noteRef}`.trim(),
      };
    });
    const dated = points
      .filter((p) => p.value !== null)
      .map((p) => p.date)
      .sort();
    for (const p of points) {
      if (p.value !== null) rows.push({ dims, date: p.date, value: p.value });
      else if (p.date > dated[0] && p.date < dated[dated.length - 1]) {
        missing.push({ dims, date: p.date, reason: "blank", detail: p.flag });
      }
    }
  }
  return { rows, missing, stats: { series: inputs.length } };
}
