/**
 * FRED (Federal Reserve Economic Data) API client.
 * https://fred.stlouisfed.org/docs/api/fred/
 */

import { fetchXml, grokDate, type ApiResult } from "./index";

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

  const xml = await fetchXml(url);

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
