/**
 * Extract BLS series from every retained vintage of every key, oldest
 * fetch first, so for each (series, date) the most recently fetched value
 * wins. Annual averages (M13, Q05, S03) are dropped; a period BLS prints
 * as "-" or "(NA)" has no row and, inside the series' range, is reported
 * as a blank missing period.
 */

import { readFileSync } from "node:fs";

import { grokDate } from "@catalog/utils/api-clients/index";
import { hstToInstant } from "@catalog/utils/time";

import type {
  ExtractRow,
  MissingPeriod,
  ParseInput,
  ParseResult,
} from "../../types";

/** BLS period code → one-letter frequency; annual averages (M13, Q05, S03) → null. */
export function blsPeriodFrequency(period: string): string | null {
  if (/^M(0[1-9]|1[0-2])$/.test(period)) return "M";
  if (/^Q0[1-4]$/.test(period)) return "Q";
  if (/^S0[12]$/.test(period)) return "S";
  if (period === "A01") return "A";
  return null;
}

type BlsPoint = { year?: string; period?: string; value?: string };

export function parseBls(inputs: readonly ParseInput[]): ParseResult {
  // oldest fetch first, so the newest vintage of each (series, date) wins
  const ordered = [...inputs].sort(
    (a, b) =>
      hstToInstant(a.artifact.lastSeenAt).getTime() -
        hstToInstant(b.artifact.lastSeenAt).getTime() ||
      a.artifact.id - b.artifact.id,
  );
  const series = new Map<
    string,
    Map<string, { value: number | null; freq: string }>
  >();
  for (const input of ordered) {
    const raw = JSON.parse(readFileSync(input.path, "utf8")) as {
      seriesID?: string;
      data?: BlsPoint[];
    };
    const id = raw.seriesID ?? String(input.artifact.metadata.seriesId ?? "");
    if (!id) throw new Error(`${input.artifact.artifactKey}: no seriesID`);
    const points = series.get(id) ?? new Map();
    for (const p of raw.data ?? []) {
      const freq = blsPeriodFrequency(p.period ?? "");
      if (!freq || !p.year) continue;
      const value = Number(String(p.value ?? "").replace(/,/g, ""));
      points.set(grokDate(p.year, p.period!), {
        // "-", "(NA)" …: BLS has no value for the period
        value: Number.isFinite(value) ? value : null,
        freq,
      });
    }
    series.set(id, points);
  }
  const rows: ExtractRow[] = [];
  const missing: MissingPeriod[] = [];
  for (const [id, points] of series) {
    const dated = [...points].filter(([, p]) => p.value !== null);
    const dates = dated.map(([d]) => d).sort();
    for (const [date, { value, freq }] of points) {
      const dims = { series_id: id, frequency: freq };
      if (value !== null) rows.push({ dims, date, value });
      else if (date > dates[0] && date < dates[dates.length - 1]) {
        missing.push({ dims, date, reason: "blank" });
      }
    }
  }
  return { rows, missing, stats: { series: series.size } };
}
