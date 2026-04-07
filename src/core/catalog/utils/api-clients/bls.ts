/**
 * BLS (Bureau of Labor Statistics) API client.
 * https://www.bls.gov/developers/
 *
 * Both fetchSeries and fetchSeriesV2 hit the v2 JSON endpoint. They share a
 * 200ms throttle and round-robin between two API keys to maximize the daily
 * request budget (BLS allows 500/day per registered key, and limits the API
 * to 50 requests per 10 seconds).
 */

import { fetchJson, fetchXml, grokDate, type ApiResult } from "./index";

// ─── Shared throttle + key rotation ──────────────────────────────────

const BLS_KEY_ENV_VARS = ["API_KEY_BLS_V2", "API_KEY_2_BLS_V2"] as const;
const BLS_MIN_INTERVAL_MS = 200;
let blsKeyIndex = 0;
let blsNextRequestAt = 0;

/** Returns the next BLS registration key, rotating across configured keys. */
function getNextBlsKey(): string {
  const keys = BLS_KEY_ENV_VARS.map((name) => process.env[name]).filter(
    (k): k is string => Boolean(k),
  );
  if (keys.length === 0) {
    throw new Error(
      `No BLS API keys defined (set ${BLS_KEY_ENV_VARS.join(" and/or ")})`,
    );
  }
  const key = keys[blsKeyIndex % keys.length];
  blsKeyIndex++;
  return key;
}

/** Sleeps until at least BLS_MIN_INTERVAL_MS has elapsed since the previous call. */
async function throttleBls(): Promise<void> {
  const now = Date.now();
  if (now < blsNextRequestAt) {
    await new Promise((r) => setTimeout(r, blsNextRequestAt - now));
  }
  blsNextRequestAt = Date.now() + BLS_MIN_INTERVAL_MS;
}

// ─── BLS v2 (single-series) ──────────────────────────────────────────

/**
 * Fetch a time series from the BLS v2 JSON API.
 *
 * @param seriesId - BLS series ID (e.g. "LNS12000000")
 * @param _frequency - Unused; the seriesId encodes frequency. Kept for signature parity.
 */
export async function fetchSeries(
  seriesId: string,
  _frequency?: string | null,
): Promise<ApiResult> {
  await throttleBls();
  const apiKey = getNextBlsKey();

  const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/${seriesId}?registrationkey=${apiKey}`;

  const json = await fetchJson<BlsV1Response>(url);

  if (!/succeeded/i.test(json.status ?? "")) {
    const msg = Array.isArray(json.message)
      ? json.message.join(" ")
      : String(json.message ?? "Unknown error");
    throw new Error(`BLS API error: ${msg}`);
  }

  const resultsData = json.Results?.series?.[0]?.data;
  if (!resultsData || resultsData.length === 0) {
    const msg = Array.isArray(json.message)
      ? json.message.join(" ")
      : "No data returned";
    throw new Error(`BLS API error: ${msg}`);
  }

  const data = new Map<string, number>();
  for (const dp of resultsData) {
    const date = grokDate(dp.year, dp.period);
    const value = parseFloat(String(dp.value).replace(/,/g, ""));
    if (!isNaN(value)) {
      data.set(date, value);
    }
  }

  return { data, url };
}

// ─── BLS v2 (JSON API) ──────────────────────────────────────────────

/**
 * Fetch a time series from the BLS v2 JSON API.
 * Uses a different API key and endpoint with year range parameters.
 *
 * @param seriesId - BLS series ID
 * @param frequency - Optional frequency filter (unused by API, kept for interface consistency)
 */
export async function fetchSeriesV2(
  seriesId: string,
  _frequency?: string | null,
): Promise<ApiResult> {
  const apiKey = getNextBlsKey()
  if (!apiKey) throw new Error("No API key defined for BLS V2");

  const thisYear = new Date().getFullYear();
  const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/${seriesId}?registrationkey=${apiKey}&startyear=${thisYear - 9}&endyear=${thisYear}`;

  const json = await fetchJson<BlsV1Response>(url);

  if (!/succeeded/i.test(json.status ?? "")) {
    const msg = Array.isArray(json.message)
      ? json.message.join(" ")
      : String(json.message ?? "Unknown error");
    throw new Error(`BLS V2 API error: ${msg}`);
  }

  const resultsData = json.Results?.series?.[0]?.data;
  if (!resultsData || resultsData.length === 0) {
    const msg = Array.isArray(json.message)
      ? json.message.join(" ")
      : "No data returned";
    throw new Error(`BLS V2 API error: ${msg}`);
  }

  const data = new Map<string, number>();
  for (const dp of resultsData) {
    const date = grokDate(dp.year, dp.period);
    const value = parseFloat(String(dp.value).replace(/,/g, ""));
    if (!isNaN(value)) {
      data.set(date, value);
    }
  }

  return { data, url };
}

// ─── Types ───────────────────────────────────────────────────────────

interface BlsDataPoint {
  year: string;
  period: string;
  value: string;
}

interface BlsV1Response {
  status?: string;
  message?: string | string[];
  Results?: {
    series?: Array<{
      data: BlsDataPoint[];
    }>;
  };
}
