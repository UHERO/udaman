/**
 * Acquire Statistics Canada vectors: the ids come from the load statements
 * that read an extractor fed by this downloader (plus config.extraFilters).
 * Each vector is stored as two artifacts:
 *
 *   <vector>/full     the whole history (getDataFromVectorsAndLatestNPeriods,
 *                     latestN 100000), taken once per vector and again
 *                     every config.fullRefreshDays (default 90) — that
 *                     catches points StatCan deletes
 *   <vector>/updates  every point released since the day before the last
 *                     full pull (getBulkVectorDataByRange), taken on every
 *                     run — revisions included, however far back
 *
 * The updates window starts at the last full pull, so its newest vintage
 * holds every change since then and parse needs only the newest vintage
 * of each key. It is stored even when empty, so after a full refresh the
 * newest updates vintage is never an older window's.
 *
 * The stored body is the vector's object of the response without
 * responseStatusCode; the series info (title, table, scalar factor, unit)
 * goes in the metadata of the full artifact.
 */

import {
  fetchBulkByReleaseRange,
  fetchSeriesInfo,
  fetchVectorsLatestN,
  tableNumber,
  type WdsResult,
  type WdsSeriesInfo,
  type WdsVectorData,
} from "@catalog/utils/api-clients/statcan";

import { HttpError } from "../../http";
import type { FetchContext } from "../../types";

/** Vectors per full-history request (a 300-vector LFS request was 31 MB) */
const FULL_BATCH = 50;
/** Vectors per updates request */
const UPDATES_BATCH = 100;
const FULL_LATEST_N = 100_000;
const DEFAULT_FULL_REFRESH_DAYS = 90;
/** Well under WDS's 25 requests/second per IP */
const THROTTLE_MS = 200;
/** 409 = table locked for a release (midnight–8:30 ET); 429 = too fast */
const RETRY_STATUSES = new Set([409, 429]);
const RETRY_PAUSE_MS = 60_000;
const MAX_ATTEMPTS = 3;
const ID_RE = /^v(\d{1,12})$/;

export type StatcanHistory = Record<string, { fullAt: string }>;

/** A stored body: one vector's object of a WDS response. */
export type StatcanFile = WdsVectorData & {
  /** updates only: the release-date window start, "YYYY-MM-DDTHH:MM" ET */
  since?: string;
};

export const vectorKey = (id: number) => `v${id}`;

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

/** Distinct vector ids ("v2062810") from the load statements. */
async function wantedVectors(ctx: FetchContext): Promise<number[]> {
  const ids = new Set<number>();
  for (const f of await ctx.referencedFilters()) {
    const raw = f.series_id;
    if (raw === undefined) continue;
    const m = ID_RE.exec(String(raw).trim());
    if (m) ids.add(Number(m[1]));
    else {
      ctx.warn(
        `"${raw}" is not a StatCan vector id (write it as StatCan does, e.g. "v2062810"); ignored`,
      );
    }
  }
  return [...ids].sort((a, b) => a - b);
}

function encode(o: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(o));
}

function body(v: WdsVectorData, since?: string): StatcanFile {
  return {
    vectorId: v.vectorId,
    productId: v.productId,
    coordinate: v.coordinate,
    ...(since !== undefined ? { since } : {}),
    vectorDataPoint: v.vectorDataPoint,
  };
}

/** One WDS call, throttled, with pauses for 409/429. */
async function call<T>(
  ctx: FetchContext,
  what: string,
  fn: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    await ctx.sleep(THROTTLE_MS);
    try {
      return await fn();
    } catch (e) {
      if (
        e instanceof HttpError &&
        RETRY_STATUSES.has(e.status) &&
        attempt < MAX_ATTEMPTS
      ) {
        ctx.log(`${what}: HTTP ${e.status}, pausing`);
        await ctx.sleep(RETRY_PAUSE_MS);
        continue;
      }
      throw e;
    }
  }
}

/**
 * A vector WDS answered FAILED for: the load statement names a vector
 * StatCan does not have. Warned, like FRED's 400 — a wrong load statement
 * must not block every other series (the load itself then fails).
 */
function warnFailed(ctx: FetchContext, r: WdsResult<unknown>) {
  for (const f of r.failed) {
    ctx.warn(
      `${vectorKey(f.vectorId)}: StatCan has no such vector (responseStatusCode ${f.responseStatusCode})`,
    );
  }
}

export async function fetchStatcan(
  ctx: FetchContext,
  today: string = isoDay(new Date()),
): Promise<void> {
  const ids = await wantedVectors(ctx);
  if (ids.length === 0) {
    ctx.log("no load statements read this downloader's extractors yet");
    return;
  }
  const refreshDays = Number(
    ctx.downloader.config.fullRefreshDays ?? DEFAULT_FULL_REFRESH_DAYS,
  );
  const history: StatcanHistory = {
    ...((ctx.state.history as StatcanHistory | undefined) ?? {}),
  };
  const get = (url: string, init?: RequestInit) => ctx.get(url, init);

  const needFull = ids.filter((id) => {
    const h = history[vectorKey(id)];
    return (
      ctx.full || !h?.fullAt || daysBetween(h.fullAt, today) >= refreshDays
    );
  });
  ctx.log(
    `${ids.length} vectors: ${needFull.length} full history, all get the releases since their last full pull`,
  );

  // full history
  for (const batch of chunks(needFull, FULL_BATCH)) {
    const what = `full history of ${batch.map(vectorKey).join(",")}`;
    let info: WdsResult<WdsSeriesInfo>;
    let data: WdsResult<WdsVectorData>;
    try {
      info = await call(ctx, what, () => fetchSeriesInfo(batch, get));
      data = await call(ctx, what, () =>
        fetchVectorsLatestN(batch, FULL_LATEST_N, get),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      for (const id of batch) ctx.keyFailed(`${vectorKey(id)}/full`, message);
      continue;
    }
    warnFailed(ctx, data);
    const infoById = new Map(info.ok.map((i) => [i.vectorId, i]));
    for (const v of data.ok) {
      const key = vectorKey(v.vectorId);
      if (v.vectorDataPoint.length === 0) {
        ctx.warn(`${key}: StatCan returned no data points`);
        continue;
      }
      const i = infoById.get(v.vectorId);
      await ctx.store(`${key}/full`, encode(body(v)), {
        contentType: "application/json",
        originalName: `${key}_full.json`,
        metadata: {
          vectorId: v.vectorId,
          table: tableNumber(v.productId),
          coordinate: v.coordinate,
          ...(i
            ? {
                title: i.SeriesTitleEn,
                frequencyCode: i.frequencyCode,
                scalarFactorCode: i.scalarFactorCode,
                memberUomCode: i.memberUomCode,
                terminated: i.terminated === 1,
              }
            : {}),
        },
      });
      history[key] = { fullAt: today };
    }
  }

  // releases since the last full pull, grouped by window start
  const bySince = new Map<string, number[]>();
  for (const id of ids) {
    const h = history[vectorKey(id)];
    if (!h?.fullAt) continue; // no full history (failed or unknown vector)
    const since = `${addDays(h.fullAt, -1)}T00:00`;
    bySince.set(since, [...(bySince.get(since) ?? []), id]);
  }
  const end = `${addDays(today, 2)}T23:59`;
  for (const [since, group] of [...bySince].sort()) {
    for (const batch of chunks(group, UPDATES_BATCH)) {
      const what = `releases since ${since} of ${batch.map(vectorKey).join(",")}`;
      let data: WdsResult<WdsVectorData>;
      try {
        data = await call(ctx, what, () =>
          fetchBulkByReleaseRange(batch, since, end, get),
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        for (const id of batch) {
          ctx.keyFailed(`${vectorKey(id)}/updates`, message);
        }
        continue;
      }
      warnFailed(ctx, data);
      for (const v of data.ok) {
        const key = vectorKey(v.vectorId);
        await ctx.store(`${key}/updates`, encode(body(v, since)), {
          contentType: "application/json",
          originalName: `${key}_updates.json`,
          metadata: { vectorId: v.vectorId, since },
        });
      }
    }
  }
  ctx.setState({ history });
}
