/**
 * BLS (Bureau of Labor Statistics) API client.
 * Supports both v1 (legacy HTML scraping) and v2 (JSON API).
 * https://www.bls.gov/developers/
 */

import { fetchJson, fetchXml, grokDate, type ApiResult } from "./index";

// ─── BLS v1 (legacy) ─────────────────────────────────────────────────

/**
 * Fetch a time series from the BLS legacy HTML endpoint.
 * Parses the text/CSV response from the survey output servlet.
 *
 * @param seriesId - BLS series ID (e.g. "LAUCN150010000000005")
 * @param frequency - Optional frequency filter
 */
export async function fetchSeries(
  seriesId: string,
  frequency?: string | null,
): Promise<ApiResult> {
  const apiKey = process.env.API_KEY_BLS;
  if (!apiKey) throw new Error("No API key defined for BLS");

  const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/${seriesId}?registration_key=${apiKey}`;

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
  const apiKey = process.env.API_KEY_BLS_V2;
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
