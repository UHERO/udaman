/**
 * DVW (UHERO Data Visualization & Warehouse) API client.
 * Internal UHERO API for visitor/tourism data.
 */

import { fetchJson, type ApiResult } from "./index";

/**
 * Fetch a time series from the DVW API.
 *
 * @param mod - Module name (e.g. "visitor")
 * @param freq - Frequency code (e.g. "M", "A")
 * @param indicator - Indicator name
 * @param dimensions - Dimension key-value pairs (e.g. { Area: "HI", Type: "total" })
 */
export async function fetchSeries(
  mod: string,
  freq: string,
  indicator: string,
  dimensions: Record<string, string>,
): Promise<ApiResult> {
  const dims = Object.entries(dimensions)
    .map(([k, v]) => `${k[0].toLowerCase()}=${v}`)
    .join("&");
  const url = `https://api.uhero.hawaii.edu/dvw/series/${mod.toLowerCase()}?f=${freq}&i=${indicator}&${dims}`;

  const json = await fetchJson<DvwResponse>(url);

  const results = json.data;
  if (!results) throw new Error("DVW API: failure - no data returned");

  const seriesData = results.series?.[0];
  if (!seriesData?.dates || !seriesData?.values) {
    throw new Error("DVW API: failure - no series data found");
  }

  const data = new Map<string, number>();
  for (let i = 0; i < seriesData.dates.length; i++) {
    const value = seriesData.values[i];
    if (value != null) {
      data.set(seriesData.dates[i], value);
    }
  }

  return { data, url };
}

// ─── Types ───────────────────────────────────────────────────────────

interface DvwResponse {
  data?: {
    series?: Array<{
      dates: string[];
      values: (number | null)[];
    }>;
  };
}
