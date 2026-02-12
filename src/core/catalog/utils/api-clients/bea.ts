/**
 * BEA (Bureau of Economic Analysis) API client.
 * https://apps.bea.gov/api/
 */

import { fetchJson, grokDate, BEA_SUPPRESSED_VALUE, type ApiResult } from "./index";

/**
 * Fetch a time series from the BEA API.
 *
 * @param dataset - BEA dataset name (e.g. "NIPA", "Regional")
 * @param filters - Key-value filter parameters (e.g. { TableName: "T10101", LineNumber: "1" })
 */
export async function fetchSeries(
  dataset: string,
  filters: Record<string, string>,
): Promise<ApiResult> {
  const apiKey = process.env.API_KEY_BEA;
  if (!apiKey) throw new Error("No API key defined for BEA");

  const queryPars = Object.entries(filters)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const url = `https://apps.bea.gov/api/data/?UserID=${apiKey}&method=GetData&datasetname=${dataset}&${queryPars}&ResultFormat=JSON&`;

  const response = await fetchJson<BeaResponse>(url);
  const beaapi = response.BEAAPI;
  if (!beaapi) throw new Error("BEA API: major unknown failure");

  const err = beaapi.Error ?? beaapi.Results?.Error;
  if (err) {
    throw new Error(
      `BEA API Error: ${err.APIErrorDescription} ${err.ErrorDetail?.Description ?? ""} (code=${err.APIErrorCode})`
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

    if (rawValue === null || (dp.NoteRef && /^\(\w+\)/i.test(dp.NoteRef.trim()))) {
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
  request: Record<string, string>,
  dataPoint: Record<string, string | undefined>,
): boolean {
  const dpUpper = Object.fromEntries(
    Object.entries(dataPoint).map(([k, v]) => [k.toUpperCase(), v])
  );

  for (const key of Object.keys(request)) {
    const dpValue = dpUpper[key.toUpperCase()] ?? "";
    const reqValue = request[key].trim().toUpperCase();
    if (dpValue && !/^(ANY|X)$/.test(reqValue) && dpValue !== request[key]) {
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
