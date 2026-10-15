/**
 * Acquire FRED series: the requests come from the load statements that
 * read an extractor fed by this downloader (plus config.extraFilters). FRED has
 * no multi-series endpoint, so it is one request per (series, frequency,
 * aggregation), throttled under FRED's 120 requests/minute, each stored as
 * its own artifact `<series id>/<freq>/<aggregation>`. Every request
 * returns the full history, so each key's newest vintage is complete.
 *
 * The stored body is the observations without FRED's realtime_start /
 * realtime_end, which are today's date on every response and would make
 * every fetch a new vintage.
 */

import {
  fetchObservationsRaw,
  FRED_AGGREGATIONS,
  FRED_FREQUENCY,
} from "@catalog/utils/api-clients/fred";

import { HttpError } from "../../http";
import type { FetchContext } from "../../types";

/** 120 requests/minute per key */
const THROTTLE_MS = 600;
const RATE_LIMIT_PAUSE_MS = 60_000;
const MAX_ATTEMPTS = 3;
const ID_RE = /^[A-Z0-9_.-]{1,40}$/;

export type FredRequest = {
  seriesId: string;
  frequency: string;
  aggregation: string;
};

export const fredKey = (r: FredRequest) =>
  `${r.seriesId}/${r.frequency}/${r.aggregation}`;

/** Distinct, valid requests from the load statements (and config.extraFilters). */
export async function wantedRequests(
  ctx: FetchContext,
): Promise<FredRequest[]> {
  const out = new Map<string, FredRequest>();
  for (const f of await ctx.referencedFilters()) {
    const seriesId = String(f.series_id ?? "")
      .trim()
      .toUpperCase();
    const frequency = String(f.frequency ?? "")
      .trim()
      .toUpperCase();
    const aggregation = String(f.aggregation ?? "avg")
      .trim()
      .toLowerCase();
    const what = JSON.stringify(f);
    if (!ID_RE.test(seriesId)) {
      ctx.warn(
        `${what}: "${f.series_id ?? ""}" is not a FRED series id; ignored`,
      );
    } else if (!FRED_FREQUENCY[frequency]) {
      ctx.warn(
        `${what}: no frequency (give one, or load into a series whose name ends in .A/.S/.Q/.M/.W/.D); ignored`,
      );
    } else if (
      !(FRED_AGGREGATIONS as readonly string[]).includes(aggregation)
    ) {
      ctx.warn(
        `${what}: aggregation must be one of ${FRED_AGGREGATIONS.join(", ")}; ignored`,
      );
    } else {
      const r = { seriesId, frequency, aggregation };
      out.set(fredKey(r), r);
    }
  }
  return [...out.values()].sort((a, b) => fredKey(a).localeCompare(fredKey(b)));
}

export async function fetchFred(ctx: FetchContext): Promise<void> {
  const requests = await wantedRequests(ctx);
  if (requests.length === 0) {
    ctx.log("no load statements read this downloader's extractors yet");
    return;
  }
  ctx.log(`${requests.length} FRED requests`);
  const get = (url: string) => ctx.get(url);

  for (const r of requests) {
    const key = fredKey(r);
    for (let attempt = 1; ; attempt++) {
      await ctx.sleep(THROTTLE_MS);
      try {
        const raw = await fetchObservationsRaw(
          r.seriesId,
          r.frequency,
          r.aggregation,
          get,
        );
        if (raw.observations.length === 0) {
          ctx.warn(`${key}: no observations`);
          break;
        }
        await ctx.store(key, new TextEncoder().encode(JSON.stringify(raw)), {
          contentType: "application/json",
          originalName: `${r.seriesId}_${r.frequency}_${r.aggregation}.json`,
          metadata: { ...r, units: raw.units },
        });
        break;
      } catch (e) {
        if (
          e instanceof HttpError &&
          e.status === 429 &&
          attempt < MAX_ATTEMPTS
        ) {
          ctx.log(`${key}: rate limited, pausing`);
          await ctx.sleep(RATE_LIMIT_PAUSE_MS);
          continue;
        }
        const message = e instanceof Error ? e.message : String(e);
        // 400 = FRED rejected the request (no such series, or a frequency
        // higher than the series'): the load statement is wrong, which
        // must not block every other series
        if (e instanceof HttpError && e.status === 400) {
          ctx.warn(`${key}: ${message}`);
        } else {
          ctx.keyFailed(key, message);
        }
        break;
      }
    }
  }
}
