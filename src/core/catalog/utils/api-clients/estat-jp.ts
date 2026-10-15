/**
 * Japan e-Stat API client.
 * https://www.e-stat.go.jp/api/
 *
 * NOTE: This routine collects only monthly data (matching Rails behavior).
 */

import {
  fetchJson,
  grokDate,
  withRateLimitRetry,
  type ApiResult,
} from "./index";

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

  const json = await withRateLimitRetry(() => fetchJson<EstatResponse>(url));
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

// ─── Raw JSON for ingest (src/core/ingest/sources/estatjp) ──────────

/** e-Stat returns one-element lists as a bare object. */
export function asArray<T>(x: T | T[] | null | undefined): T[] {
  return x == null ? [] : Array.isArray(x) ? x : [x];
}

export type EstatClass = {
  "@code": string;
  "@name": string;
  "@unit"?: string;
  "@level"?: string;
  "@parentCode"?: string;
};

export type EstatTable = {
  statsDataId: string;
  title: string;
  updatedDate: string | null;
  /** Classification id ("tab", "cat01", "area", "time", …) → its codes */
  classes: Array<{ id: string; name: string; codes: EstatClass[] }>;
  notes: Array<{ char: string; text: string }>;
  /** "@tab", "@cat01", …, "@time", optional "@unit", "$" (the value text) */
  values: Array<Record<string, string>>;
};

/** cd-filter key: "area" → "cdArea", "cat01" → "cdCat01" */
export const estatFilterParam = (key: string) =>
  `cd${key.charAt(0).toUpperCase()}${key.slice(1)}`;

/**
 * GET getStatsData for one table, narrowed by cd filters (values may be
 * comma lists), following NEXT_KEY until every page is read. `fetchImpl`
 * must throw on non-2xx. Status 1 (nothing matches the filters) returns
 * an empty table; other non-zero statuses throw.
 */
export async function fetchStatsDataRaw(
  statsDataId: string,
  filters: Record<string, string>,
  fetchImpl: (url: string) => Promise<Response>,
): Promise<EstatTable> {
  const apiKey = process.env.API_KEY_ESTATJP;
  if (!apiKey) throw new Error("No API key defined for ESTATJP");
  const out: EstatTable = {
    statsDataId,
    title: "",
    updatedDate: null,
    classes: [],
    notes: [],
    values: [],
  };
  let start: string | null = "1";
  while (start) {
    const params = new URLSearchParams({
      appId: apiKey,
      statsDataId,
      lang: "E",
      metaGetFlg: start === "1" ? "Y" : "N",
      sectionHeaderFlg: "1",
      startPosition: start,
    });
    for (const [k, v] of Object.entries(filters)) {
      params.set(estatFilterParam(k), v);
    }
    const res = await fetchImpl(
      `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?${params}`,
    );
    const json = (await res.json()) as EstatRawResponse;
    const r = json.GET_STATS_DATA;
    if (!r) throw new Error("ESTATJP: major unknown failure");
    const status = Number(r.RESULT.STATUS);
    if (status === 1) return out;
    if (status !== 0) {
      throw new Error(
        `ESTATJP ${statsDataId}: ${r.RESULT.ERROR_MSG} (status ${status})`,
      );
    }
    const sd = r.STATISTICAL_DATA;
    if (start === "1") {
      const t = sd?.TABLE_INF;
      const title = t?.TITLE;
      out.title = typeof title === "string" ? title : (title?.$ ?? "");
      out.updatedDate = t?.UPDATED_DATE ?? null;
      out.classes = asArray(sd?.CLASS_INF?.CLASS_OBJ).map((c) => ({
        id: c["@id"],
        name: c["@name"],
        codes: asArray(c.CLASS),
      }));
      out.notes = asArray(sd?.DATA_INF?.NOTE).map((n) => ({
        char: n["@char"],
        text: n.$ ?? "",
      }));
    }
    out.values.push(...asArray(sd?.DATA_INF?.VALUE));
    const next = sd?.RESULT_INF?.NEXT_KEY;
    start = next != null && String(next) !== "" ? String(next) : null;
  }
  return out;
}

interface EstatRawResponse {
  GET_STATS_DATA?: {
    RESULT: { STATUS: number | string; ERROR_MSG?: string };
    STATISTICAL_DATA?: {
      RESULT_INF?: { NEXT_KEY?: string | number };
      TABLE_INF?: {
        TITLE?: string | { $?: string };
        UPDATED_DATE?: string;
      };
      CLASS_INF?: {
        CLASS_OBJ?:
          | Array<{
              "@id": string;
              "@name": string;
              CLASS: EstatClass | EstatClass[];
            }>
          | {
              "@id": string;
              "@name": string;
              CLASS: EstatClass | EstatClass[];
            };
      };
      DATA_INF?: {
        NOTE?:
          | { "@char": string; $?: string }
          | Array<{ "@char": string; $?: string }>;
        VALUE?: Record<string, string> | Array<Record<string, string>>;
      };
    };
  };
}
