/**
 * BEA (Bureau of Economic Analysis) API client.
 * https://apps.bea.gov/api/
 *
 * BEA rate limits (per IP):
 *   - 100 API calls per minute
 *   - 100 MB per minute
 *   - 30 errors per minute
 * Exceeding any of these triggers a 1-hour block. We throttle to one request
 * every 650 ms (~92 req/min) to stay comfortably under the 100/min ceiling.
 */

import {
  BEA_SUPPRESSED_VALUE,
  fetchJson,
  grokDate,
  type ApiResult,
} from "./index";

// ─── Throttle ────────────────────────────────────────────────────────

/** Minimum interval between BEA requests. 60000/100 = 600 ms; add headroom. */
const BEA_MIN_INTERVAL_MS = 650;
let beaNextRequestAt = 0;

/**
 * Serializes concurrent callers onto fixed-spaced slots.
 *
 * `SeriesCollection.batchReload` fans out up to 25 series in parallel per
 * group, so many callers can enter this function before any of them has
 * actually sent its request. The naive "read beaNextRequestAt → sleep →
 * update beaNextRequestAt" pattern races: every concurrent caller reads
 * the *same* stale value, sleeps to the same target, and then fires in a
 * burst — blowing straight through BEA's 100 req/min ceiling.
 *
 * Instead, each caller synchronously claims its own slot (read-modify-
 * write of `beaNextRequestAt` with no intervening await), then sleeps
 * until that exact slot. Subsequent callers immediately see the updated
 * value and chain onto the next slot.
 */
async function throttleBea(): Promise<void> {
  const myTurn = Math.max(Date.now(), beaNextRequestAt);
  beaNextRequestAt = myTurn + BEA_MIN_INTERVAL_MS;
  const delay = myTurn - Date.now();
  if (delay > 0) {
    await new Promise((r) => setTimeout(r, delay));
  }
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

  await throttleBea();
  const response = await fetchJson<BeaResponse>(url);
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
