/**
 * Extract FRED series from the newest vintage of each key. A period FRED
 * prints as "." has no row and, inside the series' range, is reported as a
 * blank missing period (FRED also prints "." for a current, incomplete
 * period of an aggregated series; that one is outside the range).
 */

import { readFileSync } from "node:fs";

import type { FredRawSeries } from "@catalog/utils/api-clients/fred";
import { grokDate } from "@catalog/utils/api-clients/index";

import type {
  ExtractRow,
  MissingPeriod,
  ParseInput,
  ParseResult,
} from "../../types";

export function parseFred(inputs: readonly ParseInput[]): ParseResult {
  const rows: ExtractRow[] = [];
  const missing: MissingPeriod[] = [];
  for (const input of inputs) {
    const raw = JSON.parse(readFileSync(input.path, "utf8")) as FredRawSeries;
    if (!raw.series_id || !raw.frequency || !raw.aggregation_method) {
      throw new Error(`${input.artifact.artifactKey}: not a FRED series file`);
    }
    const dims = {
      series_id: raw.series_id,
      frequency: raw.frequency,
      aggregation: raw.aggregation_method,
    };
    const points = raw.observations.map((o) => {
      const value = Number(o.value);
      return {
        date: grokDate(o.date),
        value: o.value !== "." && Number.isFinite(value) ? value : null,
      };
    });
    const dated = points.filter((p) => p.value !== null).map((p) => p.date);
    const first = dated.reduce((a, b) => (b < a ? b : a), dated[0]);
    const last = dated.reduce((a, b) => (b > a ? b : a), dated[0]);
    for (const p of points) {
      if (p.value !== null) rows.push({ dims, date: p.date, value: p.value });
      else if (p.date > first && p.date < last) {
        missing.push({ dims, date: p.date, reason: "blank" });
      }
    }
  }
  return { rows, missing, stats: { series: inputs.length } };
}
