/**
 * EIA (Energy Information Administration) v2 API client.
 * Used by both AEO (Annual Energy Outlook) and STEO (Short-Term Energy Outlook).
 * https://www.eia.gov/opendata/
 */

import { fetchJson, grokDate, type ApiResult } from "./index";

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

  const response = await fetchJson<EiaResponse>(url);

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
