/**
 * Japan e-Stat API client.
 * https://www.e-stat.go.jp/api/
 *
 * NOTE: This routine collects only monthly data (matching Rails behavior).
 */

import { fetchJson, grokDate, type ApiResult } from "./index";

/**
 * Fetch a time series from the Japan e-Stat API.
 *
 * @param code - Stats data ID
 * @param filters - Category dimension filters (e.g. { Area: "00000", Cat01: "001" })
 */
export async function fetchSeries(
  code: string,
  filters: Record<string, string>,
): Promise<ApiResult> {
  const apiKey = process.env.API_KEY_ESTATJP;
  if (!apiKey) throw new Error("No API key defined for ESTATJP");

  const apiVersion = "3.0";
  const query = Object.entries(filters)
    .map(([key, value]) => `cd${capitalize(key)}=${value}`)
    .join("&");
  const url =
    `https://api.e-stat.go.jp/rest/${apiVersion}/app/json/getStatsData?` +
    `appId=${apiKey}&statsDataId=${code}&${query}&lang=E&metaGetFlg=Y&sectionHeaderFlg=1`;

  const json = await fetchJson<EstatResponse>(url);
  const apiReturn = json.GET_STATS_DATA;
  if (!apiReturn) throw new Error("ESTATJP: major unknown failure");

  if (apiReturn.RESULT.STATUS !== 0) {
    throw new Error(`ESTATJP Error: ${apiReturn.RESULT.ERROR_MSG}`);
  }

  const statData = apiReturn.STATISTICAL_DATA;
  if (!statData) throw new Error("ESTATJP: no results included");

  const results = statData.DATA_INF?.VALUE;
  if (!results) throw new Error("ESTATJP: results, but no data");

  const data = new Map<string, number>();
  for (const dp of results) {
    if (!filterMatch(filters, dp)) continue;

    const timePeriod = dp["@time"];
    // Skip period "00" (annual totals when expecting monthly)
    if (timePeriod.slice(-2) === "00") continue;

    const rawValue = dp["$"];
    if (rawValue && !isNaN(parseFloat(rawValue.replace(/,/g, "")))) {
      const date = grokDate(timePeriod.slice(0, 4), timePeriod.slice(-2));
      data.set(date, parseFloat(rawValue.replace(/,/g, "")));
    }
  }

  return { data, url };
}

function filterMatch(
  filters: Record<string, string>,
  dp: Record<string, string>,
): boolean {
  for (const key of Object.keys(filters)) {
    const dpKey = `@${key}`;
    if (dp[dpKey] !== String(filters[key])) return false;
  }
  return true;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Types ───────────────────────────────────────────────────────────

interface EstatResponse {
  GET_STATS_DATA?: {
    RESULT: { STATUS: number; ERROR_MSG?: string };
    STATISTICAL_DATA?: {
      DATA_INF?: {
        VALUE?: Array<Record<string, string>>;
      };
    };
  };
}
