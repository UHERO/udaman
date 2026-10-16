/**
 * FRED (Federal Reserve Economic Data) API client.
 * https://fred.stlouisfed.org/docs/api/fred/
 */

import {
  fetchXml,
  grokDate,
  withRateLimitRetry,
  type ApiResult,
} from "./index";

/**
 * Fetch a time series from the FRED API.
 *
 * @param code - FRED series ID (e.g. "GDP", "UNRATE")
 * @param frequency - Optional frequency filter: d, w, bw, m, q, sa, a
 * @param aggregationMethod - Optional aggregation: avg, sum, eop
 */
export async function fetchSeries(
  code: string,
  frequency?: string | null,
  aggregationMethod?: string | null,
): Promise<ApiResult> {
  const apiKey = process.env.API_KEY_FRED;
  if (!apiKey) throw new Error("No API key defined for FRED");

  let url = `https://api.stlouisfed.org/fred/series/observations?api_key=${apiKey}&series_id=${code}`;

  if (frequency) {
    // FRED uses "sa" for semiannual; udaman uses "S"
    const freqParam = frequency.toLowerCase().replace(/^s$/, "sa");
    url += `&frequency=${freqParam}`;
  }
  if (aggregationMethod) {
    url += `&aggregation_method=${aggregationMethod.toLowerCase()}`;
  }

  const xml = await withRateLimitRetry(() => fetchXml(url));

  // Check for API errors
  const errorMatch = xml.match(
    /<error\s[^>]*message="([^"]*)"[^>]*code="([^"]*)"/,
  );
  if (errorMatch) {
    throw new Error(`FRED API Error: ${errorMatch[1]} (code=${errorMatch[2]})`);
  }

  const data = new Map<string, number>();
  const obsRegex =
    /<observation\s[^>]*date="([^"]*)"[^>]*value="([^"]*)"[^>]*\/>/g;
  let match: RegExpExecArray | null;

  while ((match = obsRegex.exec(xml)) !== null) {
    const [, date, value] = match;
    if (value === ".") continue; // FRED uses "." for missing data
    const num = parseFloat(value);
    if (!isNaN(num)) {
      data.set(grokDate(date), num);
    }
  }

  return { data, url };
}

// ─── Raw JSON for ingest (src/core/ingest/sources/fred) ──────────────

/** udaman frequency letter → FRED `frequency` param */
export const FRED_FREQUENCY: Record<string, string> = {
  A: "a",
  S: "sa",
  Q: "q",
  M: "m",
  W: "w",
  D: "d",
};

export const FRED_AGGREGATIONS = ["avg", "sum", "eop"] as const;

/**
 * One series' observations, minus the volatile parts of the response:
 * FRED stamps today's date as realtime_start/realtime_end on the response
 * and on every observation, so the stored bytes would change daily.
 */
export type FredRawSeries = {
  series_id: string;
  /** udaman letter (A/S/Q/M/W/D) requested */
  frequency: string;
  aggregation_method: string;
  units: string;
  /** value "." = no value for the period */
  observations: Array<{ date: string; value: string }>;
};

const FRED_PAGE = 100_000;

/**
 * GET series/observations as JSON (all pages) through `fetchImpl`, which
 * must throw on non-2xx. FRED has no multi-series endpoint (v2's
 * release/observations is per release and cannot aggregate), so this is
 * one series per request.
 */
export async function fetchObservationsRaw(
  seriesId: string,
  frequency: string,
  aggregation: string,
  fetchImpl: (url: string) => Promise<Response>,
): Promise<FredRawSeries> {
  const apiKey = process.env.API_KEY_FRED;
  if (!apiKey) throw new Error("No API key defined for FRED");
  const freqParam = FRED_FREQUENCY[frequency];
  if (!freqParam) throw new Error(`FRED: unknown frequency "${frequency}"`);
  const out: FredRawSeries = {
    series_id: seriesId,
    frequency,
    aggregation_method: aggregation,
    units: "",
    observations: [],
  };
  for (let offset = 0; ;) {
    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: apiKey,
      file_type: "json",
      frequency: freqParam,
      aggregation_method: aggregation,
      limit: String(FRED_PAGE),
      offset: String(offset),
    });
    const res = await fetchImpl(
      `https://api.stlouisfed.org/fred/series/observations?${params}`,
    );
    const json = (await res.json()) as {
      units?: string;
      count?: number;
      error_message?: string;
      observations?: Array<{ date?: string; value?: string }>;
    };
    if (json.error_message) throw new Error(`FRED: ${json.error_message}`);
    out.units = json.units ?? out.units;
    const page = json.observations ?? [];
    for (const o of page) {
      if (o.date)
        out.observations.push({ date: o.date, value: o.value ?? "." });
    }
    offset += page.length;
    if (page.length === 0 || offset >= (json.count ?? 0)) break;
  }
  return out;
}
