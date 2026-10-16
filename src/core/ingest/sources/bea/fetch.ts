/**
 * Acquire BEA series. BEA answers a whole table at once — Regional with
 * LineCode=ALL for one GeoFips, NIPA without LineNumber and with
 * Frequency=A,Q,M — so the load statements are grouped into ~40 requests
 * instead of one per series. Each response is split by series (line, geo,
 * frequency) and only the series the load statements ask for are stored,
 * one artifact each, holding that series' own rows sorted by period (not
 * the request echo, which holds the key, or the production timestamp).
 *
 * BEA limits: 100 requests, 100 MB and 30 errors per minute, else a
 * one-hour lockout. Requests are paced by response size, and the run stops
 * after a few API errors in a row. A rejected request (code 40: retired
 * table, bad geo) is a warning, like a series BLS has no data for.
 */

import {
  BeaApiError,
  fetchGetDataRaw,
  type BeaDataPoint,
} from "@catalog/utils/api-clients/bea";

import type { FetchContext } from "../../types";

const MIN_GAP_MS = 1000;
/** ≈ 80 MB/minute */
const BYTES_PER_MS = 80_000_000 / 60_000;
const MAX_CONSECUTIVE_ERRORS = 5;
const DATASETS = ["Regional", "NIPA"] as const;
type Dataset = (typeof DATASETS)[number];

/** What one stored artifact holds: one series. */
export type BeaSeriesFile = {
  dataset: Dataset;
  table: string;
  line: string;
  /** GeoFips, "-" for NIPA */
  geo: string;
  frequency: string;
  description: string | null;
  unit: string | null;
  unitMult: string | null;
  seriesCode: string | null;
  points: Array<{ period: string; value: string; noteRef: string }>;
};

type SeriesId = Pick<
  BeaSeriesFile,
  "dataset" | "table" | "line" | "geo" | "frequency"
>;

export const beaKey = (s: SeriesId) =>
  `${s.dataset}/${s.table}/${s.line}/${s.geo}/${s.frequency}`;

/** BEA TimePeriod → one-letter frequency: "2024" A, "2024Q1" Q, "2024M01" M. */
export function periodFrequency(tp: string): string | null {
  if (/^\d{4}$/.test(tp)) return "A";
  if (/^\d{4}Q[1-4]$/.test(tp)) return "Q";
  if (/^\d{4}M(0[1-9]|1[0-2])$/.test(tp)) return "M";
  return null;
}

/** The series a data row belongs to. */
export function rowSeries(
  dataset: Dataset,
  table: string,
  dp: BeaDataPoint,
): SeriesId | null {
  const frequency = periodFrequency(dp.TimePeriod ?? "");
  if (!frequency) return null;
  if (dataset === "NIPA") {
    return {
      dataset,
      table,
      line: String(dp.LineNumber ?? ""),
      geo: "-",
      frequency,
    };
  }
  // Regional rows carry the line inside Code: "CAINC5N-802"
  const code = String(dp.Code ?? "");
  return {
    dataset,
    table,
    line: code.slice(code.lastIndexOf("-") + 1),
    geo: String(dp.GeoFips ?? ""),
    frequency,
  };
}

/** Split a response into one file per series, kept only when `wanted`. */
export function splitSeries(
  dataset: Dataset,
  table: string,
  data: BeaDataPoint[],
  wanted: (key: string) => boolean,
): BeaSeriesFile[] {
  const out = new Map<string, BeaSeriesFile>();
  for (const dp of data) {
    const s = rowSeries(dataset, table, dp);
    if (!s) continue;
    const key = beaKey(s);
    if (!wanted(key)) continue;
    let f = out.get(key);
    if (!f) {
      f = {
        ...s,
        description: dp.LineDescription ?? dp.Description ?? null,
        unit: dp.CL_UNIT ?? null,
        unitMult: dp.UNIT_MULT ?? null,
        seriesCode: dp.SeriesCode ?? null,
        points: [],
      };
      out.set(key, f);
    }
    f.points.push({
      period: dp.TimePeriod,
      value: dp.DataValue ?? "",
      noteRef: dp.NoteRef ?? "",
    });
  }
  for (const f of out.values()) {
    f.points.sort((a, b) => a.period.localeCompare(b.period));
  }
  return [...out.values()];
}

type Request = {
  dataset: Dataset;
  table: string;
  geo: string;
  keys: Set<string>;
};

async function wantedRequests(ctx: FetchContext): Promise<Request[]> {
  const out = new Map<string, Request>();
  for (const f of await ctx.referencedFilters()) {
    const what = JSON.stringify(f);
    const dataset = DATASETS.find(
      (d) =>
        d.toLowerCase() ===
        String(f.dataset ?? "")
          .trim()
          .toLowerCase(),
    );
    const table = String(f.table ?? "")
      .trim()
      .toUpperCase();
    const line = String(f.line ?? "").trim();
    const frequency = String(f.frequency ?? "")
      .trim()
      .toUpperCase();
    const geo = dataset === "NIPA" ? "-" : String(f.geo ?? "").trim();
    if (!dataset)
      ctx.warn(`${what}: dataset must be ${DATASETS.join(" or ")}; ignored`);
    else if (!/^[A-Z0-9]+$/.test(table)) ctx.warn(`${what}: no table; ignored`);
    else if (!/^\d+$/.test(line)) ctx.warn(`${what}: no line; ignored`);
    else if (dataset === "Regional" && !/^\d{5}$/.test(geo))
      ctx.warn(`${what}: no geo (5-digit GeoFips); ignored`);
    else if (!["A", "Q", "M"].includes(frequency)) {
      ctx.warn(
        `${what}: no frequency (give one, or load into a series whose name ends in .A/.Q/.M); ignored`,
      );
    } else {
      const g = `${dataset}/${table}/${geo}`;
      const r = out.get(g) ?? { dataset, table, geo, keys: new Set<string>() };
      r.keys.add(beaKey({ dataset, table, line, geo, frequency }));
      out.set(g, r);
    }
  }
  return [...out.values()].sort((a, b) =>
    `${a.dataset}/${a.table}/${a.geo}`.localeCompare(
      `${b.dataset}/${b.table}/${b.geo}`,
    ),
  );
}

export async function fetchBea(ctx: FetchContext): Promise<void> {
  const requests = await wantedRequests(ctx);
  if (requests.length === 0) {
    ctx.log("no load statements read this downloader's extractors yet");
    return;
  }
  const series = requests.reduce((n, r) => n + r.keys.size, 0);
  ctx.log(`${series} series in ${requests.length} BEA requests`);
  const get = (url: string) => ctx.get(url);
  let gap = 0;
  let errors = 0;
  for (const [i, r] of requests.entries()) {
    const group = `${r.dataset}/${r.table}/${r.geo}`;
    if (errors >= MAX_CONSECUTIVE_ERRORS) {
      for (const rest of requests.slice(i)) {
        ctx.keyFailed(
          `${rest.dataset}/${rest.table}/${rest.geo}`,
          "not requested: too many BEA errors in a row",
        );
      }
      break;
    }
    await ctx.sleep(gap);
    const params: Record<string, string> =
      r.dataset === "NIPA"
        ? { TableName: r.table, Frequency: "A,Q,M", Year: "ALL" }
        : { TableName: r.table, LineCode: "ALL", GeoFips: r.geo, Year: "ALL" };
    let data: BeaDataPoint[];
    try {
      const res = await fetchGetDataRaw(r.dataset, params, get);
      data = res.data;
      gap = Math.max(MIN_GAP_MS, Math.ceil(res.bytes / BYTES_PER_MS));
      errors = 0;
    } catch (e) {
      gap = MIN_GAP_MS;
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof BeaApiError) errors++;
      // code 40: BEA rejects the parameters (a retired table, a bad geo) —
      // the load statements are wrong, which must not block every other
      // series
      if (e instanceof BeaApiError && e.code === "40") {
        ctx.warn(`${group}: ${message}`);
      } else {
        ctx.keyFailed(group, message);
      }
      continue;
    }
    const files = splitSeries(r.dataset, r.table, data, (k) => r.keys.has(k));
    ctx.log(
      `${group}: ${data.length} rows, ${files.length} of ${r.keys.size} series`,
    );
    for (const f of files) {
      await ctx.store(beaKey(f), new TextEncoder().encode(JSON.stringify(f)), {
        contentType: "application/json",
        originalName: `${beaKey(f).replace(/\//g, "_")}.json`,
        metadata: {
          dataset: f.dataset,
          table: f.table,
          line: f.line,
          geo: f.geo,
          frequency: f.frequency,
        },
      });
    }
    const stored = new Set(files.map((f) => beaKey(f)));
    for (const k of r.keys) {
      if (!stored.has(k)) ctx.warn(`${k}: not in the response`);
    }
  }
}
