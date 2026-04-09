/**
 * BEA (Bureau of Economic Analysis) API client.
 * https://apps.bea.gov/api/
 *
 * BEA rate limits (per IP):
 *   - 100 API calls per minute
 *   - 100 MB per minute
 *   - 30 errors per minute
 * Exceeding any of these triggers a 1-hour block. We sleep 100 ms before
 * each request (added to actual request latency keeps us under 100/min for
 * sequential callers) and pause for 60 s on observed 429s before retrying.
 */

import {
  BEA_SUPPRESSED_VALUE,
  fetchJson,
  grokDate,
  type ApiResult,
} from "./index";

// ─── Throttle ────────────────────────────────────────────────────────

/**
 * Light per-request sleep to space out batch reloads. Most batch reload
 * paths are already sequential, so 100 ms of additional spacing on top of
 * actual request latency keeps us under BEA's 100 req/min ceiling for any
 * realistic response time. The real safety net for bursting is the 429
 * retry-after-pause logic in `fetchSeries` below.
 */
const BEA_REQUEST_SLEEP_MS = 100;

/** Pause length when a 429 (or BEA equivalent) is observed. */
const BEA_RATE_LIMIT_PAUSE_MS = 60_000;

/** Max attempts (initial + retries) for a single BEA request. */
const BEA_MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|too many requests|rate limit/i.test(msg);
}

/**
 * Fetch a time series from the BEA API.
 *
 * @param dataset - BEA dataset name (e.g. "NIPA", "Regional")
 * @param filters - Key-value filter parameters (e.g. { TableName: "T10101", LineNumber: "1" }).
 *   Numeric values are accepted because Ruby kwargs from the eval column
 *   (`LineCode: 1, GeoFips: 15001`) reach this function as JS numbers after
 *   `eval-executor.ts:resolveArg` was changed to preserve underlying types.
 */
export async function fetchSeries(
  dataset: string,
  filters: Record<string, string | number>,
): Promise<ApiResult> {
  const apiKey = process.env.API_KEY_BEA;
  if (!apiKey) throw new Error("No API key defined for BEA");

  const queryPars = Object.entries(filters)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const url = `https://apps.bea.gov/api/data/?UserID=${apiKey}&method=GetData&datasetname=${dataset}&${queryPars}&ResultFormat=JSON&`;

  let response: BeaResponse | undefined;
  for (let attempt = 1; attempt <= BEA_MAX_ATTEMPTS; attempt++) {
    await sleep(BEA_REQUEST_SLEEP_MS);
    try {
      response = await fetchJson<BeaResponse>(url);
      break;
    } catch (e) {
      if (isRateLimitError(e) && attempt < BEA_MAX_ATTEMPTS) {
        await sleep(BEA_RATE_LIMIT_PAUSE_MS);
        continue;
      }
      throw e;
    }
  }
  if (!response) throw new Error("BEA API: no response");

  const beaapi = response.BEAAPI;
  if (!beaapi) throw new Error("BEA API: major unknown failure");

  const err = beaapi.Error ?? beaapi.Results?.Error;
  if (err) {
    throw new Error(
      `BEA API Error: ${err.APIErrorDescription} ${err.ErrorDetail?.Description ?? ""} (code=${err.APIErrorCode})`,
    );
  }

  if (!beaapi.Results) throw new Error("BEA API: no results included");
  const resultsData = beaapi.Results.Data;
  if (!resultsData) throw new Error("BEA API: results, but no data");

  const data = new Map<string, number>();
  for (const dp of resultsData) {
    if (!requestMatch(filters, dp)) continue;

    const tp = dp.TimePeriod;
    const date = grokDate(tp.slice(0, 4), tp.slice(4));

    const rawValue = dp.DataValue?.trim().replace(/,/g, "") ?? null;
    let value: number;

    if (
      rawValue === null ||
      (dp.NoteRef && /^\(\w+\)/i.test(dp.NoteRef.trim()))
    ) {
      value = BEA_SUPPRESSED_VALUE;
    } else {
      value = parseFloat(rawValue);
      if (isNaN(value)) {
        throw new Error(`BEA API: Problem with value at ${date}`);
      }
    }

    data.set(date, value);
  }

  return { data, url };
}

/** Check if a data point matches all requested filter keys. */
function requestMatch(
  request: Record<string, string | number>,
  dataPoint: Record<string, string | undefined>,
): boolean {
  const dpUpper = Object.fromEntries(
    Object.entries(dataPoint).map(([k, v]) => [
      k.toUpperCase(),
      v?.toUpperCase(),
    ]),
  );

  for (const key of Object.keys(request)) {
    const dpValue = dpUpper[key.toUpperCase()] ?? "";
    const reqValue = String(request[key]).trim().toUpperCase();
    if (dpValue && !/^(ANY|X)$/.test(reqValue) && dpValue !== reqValue) {
      return false;
    }
  }
  return true;
}

// ─── Types ───────────────────────────────────────────────────────────

interface BeaError {
  APIErrorCode?: string;
  APIErrorDescription?: string;
  ErrorDetail?: { Description?: string };
}

interface BeaDataPoint {
  TimePeriod: string;
  DataValue?: string;
  NoteRef?: string;
  [key: string]: string | undefined;
}

interface BeaResponse {
  BEAAPI?: {
    Error?: BeaError;
    Results?: {
      Error?: BeaError;
      Data?: BeaDataPoint[];
    };
  };
}
