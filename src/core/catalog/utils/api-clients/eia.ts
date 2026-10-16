/**
 * EIA (Energy Information Administration) v2 API client.
 * Used by both AEO (Annual Energy Outlook) and STEO (Short-Term Energy Outlook).
 * https://www.eia.gov/opendata/
 */

import {
  fetchJson,
  grokDate,
  withRateLimitRetry,
  type ApiResult,
} from "./index";

/**
 * Fetch a time series from the EIA v2 API.
 *
 * @param route - API route (e.g. "aeo/2023", "steo")
 * @param scenario - Scenario facet filter (null for STEO)
 * @param seriesId - Series ID facet filter
 * @param frequency - Frequency facet (e.g. "annual", "monthly")
 * @param valueIn - Data field to extract (e.g. "value")
 */
export async function fetchSeries(
  route: string,
  scenario: string | null,
  seriesId: string,
  frequency: string,
  valueIn: string,
): Promise<ApiResult> {
  const apiKey = process.env.API_KEY_EIA;
  if (!apiKey) throw new Error("No API key defined for EIA");

  let url = `https://api.eia.gov/v2/${route}/data?api_key=${apiKey}`;
  if (scenario) url += `&facets[scenario][]=${scenario}`;
  if (seriesId) url += `&facets[seriesId][]=${seriesId}`;
  if (frequency) url += `&frequency=${frequency}`;
  if (valueIn) url += `&data[]=${valueIn}`;

  const response = await withRateLimitRetry(() => fetchJson<EiaResponse>(url));

  if (response.error) {
    const msg = response.error.message ?? JSON.stringify(response.error);
    throw new Error(`EIA API error: ${msg}`);
  }

  const apiData = response.response?.data;
  if (!apiData || apiData.length === 0) {
    throw new Error(
      "EIA API: Response is empty; check parameters, they are case-sensitive",
    );
  }

  const data = new Map<string, number>();
  for (const dp of apiData) {
    const date = grokDate(dp.period);
    const value = parseFloat(String(dp[valueIn]));
    if (!isNaN(value)) {
      data.set(date, value);
    }
  }

  return { data, url };
}

// ─── Types ───────────────────────────────────────────────────────────

interface EiaResponse {
  error?: { message?: string };
  response?: {
    data?: Array<Record<string, string>>;
  };
}

// ─── Raw JSON for ingest (src/core/ingest/sources/eia) ───────────────

/** udaman frequency letter → EIA v2 `frequency` */
export const EIA_FREQUENCY: Record<string, string> = {
  A: "annual",
  Q: "quarterly",
  M: "monthly",
  W: "weekly",
  D: "daily",
};

const EIA_PAGE = 5000;

/**
 * GET `/v2/<route>/data` for several series ids (and scenarios) at once,
 * every page, oldest period first. `fetchImpl` must throw on non-2xx.
 * Returns the data rows as EIA prints them.
 */
export async function fetchRouteDataRaw(
  route: string,
  frequency: string,
  facets: { seriesId: string[]; scenario?: string[] },
  fetchImpl: (url: string) => Promise<Response>,
): Promise<Array<Record<string, string | null>>> {
  const apiKey = process.env.API_KEY_EIA;
  if (!apiKey) throw new Error("No API key defined for EIA");
  const freq = EIA_FREQUENCY[frequency];
  if (!freq) throw new Error(`EIA: unknown frequency "${frequency}"`);
  const rows: Array<Record<string, string | null>> = [];
  for (;;) {
    const offset = rows.length;
    const params = new URLSearchParams({ api_key: apiKey, frequency: freq });
    params.append("data[]", "value");
    for (const s of facets.seriesId) params.append("facets[seriesId][]", s);
    for (const s of facets.scenario ?? [])
      params.append("facets[scenario][]", s);
    params.set("sort[0][column]", "period");
    params.set("sort[0][direction]", "asc");
    params.set("offset", String(offset));
    params.set("length", String(EIA_PAGE));
    const res = await fetchImpl(
      `https://api.eia.gov/v2/${route}/data?${params}`,
    );
    const json = (await res.json()) as {
      error?: string | { message?: string };
      response?: {
        total?: string | number;
        data?: Array<Record<string, string | null>>;
      };
    };
    if (json.error) {
      const msg =
        typeof json.error === "string"
          ? json.error
          : (json.error.message ?? JSON.stringify(json.error));
      throw new Error(`EIA API error: ${msg}`);
    }
    const page = json.response?.data ?? [];
    rows.push(...page);
    const total = Number(json.response?.total ?? rows.length);
    if (page.length === 0 || rows.length >= total) break;
  }
  return rows;
}
