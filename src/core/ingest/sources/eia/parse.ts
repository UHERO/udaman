/**
 * Extract EIA series from the newest vintage of each key. A period with no
 * value (null, "", "NA") has no row and, inside the series' range, is a
 * blank missing period.
 */

import { readFileSync } from "node:fs";

import { grokDate } from "@catalog/utils/api-clients/index";

import type {
  ExtractRow,
  MissingPeriod,
  ParseInput,
  ParseResult,
} from "../../types";
import type { EiaSeriesFile } from "./fetch";

export function parseEia(inputs: readonly ParseInput[]): ParseResult {
  const rows: ExtractRow[] = [];
  const missing: MissingPeriod[] = [];
  for (const input of inputs) {
    const raw = JSON.parse(readFileSync(input.path, "utf8")) as EiaSeriesFile;
    if (!raw.route || !raw.seriesId || !raw.frequency) {
      throw new Error(`${input.artifact.artifactKey}: not an EIA series file`);
    }
    const dims = {
      route: raw.route,
      scenario: raw.scenario,
      series_id: raw.seriesId,
      frequency: raw.frequency,
    };
    const points = raw.data.map((d) => {
      const n = Number(String(d.value ?? "").trim());
      return {
        date: grokDate(d.period),
        value:
          d.value !== null &&
          String(d.value).trim() !== "" &&
          Number.isFinite(n)
            ? n
            : null,
      };
    });
    const dated = points
      .filter((p) => p.value !== null)
      .map((p) => p.date)
      .sort();
    for (const p of points) {
      if (p.value !== null) rows.push({ dims, date: p.date, value: p.value });
      else if (p.date > dated[0] && p.date < dated[dated.length - 1]) {
        missing.push({ dims, date: p.date, reason: "blank" });
      }
    }
  }
  return { rows, missing, stats: { series: inputs.length } };
}
