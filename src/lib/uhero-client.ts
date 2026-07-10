/**
 * HTTP client for UHERO's REST API:
 *   - uheroFetch()                  : shared fetch with Authorization header,
 *                                     JSON unwrapping, and an `unrestricted`
 *                                     option that swaps the base URL between
 *                                     /v1 and /v1.u
 *   - searchSeries()                : legacy fuzzy search via ?search_text=
 *   - searchSeriesByText()          : /search/series?q= endpoint (searches
 *                                     title + description, better for free-text)
 *   - getSeriesByCode()             : exact-match lookup via /series?name=&u=.
 *                                     Detects UHERO's hollow not-found shape
 *                                     ({id:0, name:""}) and returns null.
 *   - getSeriesByCodeWithObservations()
 *                                   : uses ?expand=true to get series +
 *                                     observations in one call. Needed because
 *                                     /v1.u doesn't expose /series/observations
 *   - getSeriesObservations()       : observations by id (public API only)
 *   - listGeographiesForSeries, getCategorySeries, listCategories,
 *     getSeriesSiblings, normalizeObservations
 */

import "server-only";

const UHERO_BASE_URL = "https://api.uhero.hawaii.edu/v1";
// Unrestricted API base — returns series that aren't published to the public
// API. Only a subset of endpoints exist here (notably /series?name=&u=); /id,
// /search, /category, and /series/observations all 404 on this prefix.
const UHERO_UNRESTRICTED_BASE_URL = "https://api.uhero.hawaii.edu/v1.u";

export type Frequency = "A" | "Q" | "M" | "W" | "D";
export type Transform = "lvl" | "pch" | "pc1" | "ytd" | "chg" | "ch1";

export interface SeriesMeta {
  id: number;
  name: string;
  title?: string;
  description?: string;
  frequency: string;
  frequencyShort: Frequency;
  geography?: { handle: string; name: string; fips?: string };
  units?: string;
  unitsLabel?: string;
  unitsLabelShort?: string;
  seasonallyAdjusted?: boolean;
  decimals?: number;
  observationStart?: string;
  observationEnd?: string;
}

export interface ObservationPoint {
  date: string;
  value: number | null;
}

export interface UheroEnvelope<T> {
  data: T;
}

async function uheroFetch<T>(
  path: string,
  searchParams?: Record<string, string | number | undefined>,
  options: { unrestricted?: boolean } = {},
): Promise<T> {
  const token = process.env.REST_API_TOKEN;
  if (!token) {
    throw new Error("REST_API_TOKEN is not set");
  }

  const base = options.unrestricted
    ? UHERO_UNRESTRICTED_BASE_URL
    : UHERO_BASE_URL;
  const url = new URL(`${base}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url, {
    headers: {
      Authorization: token,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.text();
      detail = body.slice(0, 200);
    } catch {
      // ignore — best-effort body read for error detail
    }
    throw new UheroApiError(
      `UHERO API ${res.status} for ${path}: ${detail}`,
      res.status,
    );
  }

  const json = (await res.json()) as UheroEnvelope<T>;
  return json.data;
}

export class UheroApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "UheroApiError";
  }
}

export interface RawSeries {
  id: number;
  name: string;
  title?: string;
  description?: string;
  frequency: string;
  frequencyShort: Frequency;
  geography?: { handle: string; name: string; fips?: string };
  units?: string;
  unitsLabel?: string;
  unitsLabelShort?: string;
  seasonallyAdjusted?: boolean;
  decimals?: number;
  observationStart?: string;
  observationEnd?: string;
}

export async function searchSeries(params: {
  search_text?: string;
  geo?: string;
  freq?: Frequency;
  id?: number;
}): Promise<RawSeries[]> {
  // /series shapes:
  //   - id=N      → single object in `data`
  //   - search_text → array in `data`
  //   - no hits   → `data: null`
  const data = await uheroFetch<RawSeries[] | RawSeries | null>(
    "/series",
    params,
  );
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object") return [data as RawSeries];
  return [];
}

/**
 * Exact-match lookup by full code (e.g. "YPJ_R@HAW.Q"). UHERO's full-text
 * search via `search_text` doesn't index code stems, so we use `name=` +
 * `u=uhero` which is an exact code lookup. Returns null if not found.
 *
 * When `unrestricted` is true, uses the `/v1.u` API prefix which can return
 * series that aren't published to the public API. Caller must have an API
 * token that authorizes the unrestricted endpoint.
 */
export async function getSeriesByCode(
  code: string,
  options: { universe?: string; unrestricted?: boolean } = {},
): Promise<RawSeries | null> {
  const { universe = "uhero", unrestricted = false } = options;
  const data = await uheroFetch<RawSeries | { series: RawSeries } | null>(
    "/series",
    { name: code, u: universe },
    { unrestricted },
  );
  if (data == null) return null;
  // Some response shapes wrap the series in { series: {...} }. Normalize.
  const series =
    typeof data === "object" && "series" in data && data.series
      ? (data as { series: RawSeries }).series
      : (data as RawSeries);
  // UHERO returns 200 with a hollow object ({id:0, name:""}) when the series
  // doesn't exist instead of a 404 or null. Treat that as not-found.
  if (!series || !series.id || !series.name) return null;
  return series;
}

/**
 * Full-text search across series title + description via UHERO's
 * `/search/series?q=` endpoint. Good for free-text user queries like
 * "unemployment" or "tourism". UHERO matches the phrase as-is (not per-word),
 * so multi-word queries often return empty. Caller should split into single
 * keywords or use the simplest one for best recall.
 *
 * Only available on the public API (not /v1.u). Returns [] (not null) when no matches.
 */
export async function searchSeriesByText(params: {
  q: string;
  geo?: string;
  freq?: Frequency;
}): Promise<RawSeries[]> {
  const data = await uheroFetch<RawSeries[] | null>("/search/series", {
    q: params.q,
    geo: params.geo,
    freq: params.freq,
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch a series with observations inline via `?expand=true`. Used for the
 * unrestricted API path, which doesn't expose `/series/observations?id=` —
 * the only way to get unrestricted observations is via the expanded series
 * lookup by name. Returns { series, observations } or null if not found.
 */
export async function getSeriesByCodeWithObservations(
  code: string,
  options: { universe?: string; unrestricted?: boolean } = {},
): Promise<{ series: RawSeries; observations: RawObservations } | null> {
  const { universe = "uhero", unrestricted = false } = options;
  const data = await uheroFetch<{
    series: RawSeries;
    observations: RawObservations;
  } | null>(
    "/series",
    { name: code, u: universe, expand: "true" },
    { unrestricted },
  );
  if (!data || !data.series || !data.series.id || !data.series.name) {
    return null;
  }
  return data;
}

export interface RawObservations {
  observationStart: string;
  observationEnd: string;
  orderBy: string;
  sortOrder: string;
  frequency?: string;
  transformationResults: Array<{
    transformation: string;
    dates?: string[];
    values?: Array<string | number | null>;
    pseudoHistory?: boolean[];
  }>;
}

export async function getSeriesObservations(
  id: number,
  transform: Transform = "lvl",
): Promise<RawObservations> {
  return uheroFetch<RawObservations>("/series/observations", {
    id,
    transformations: transform,
  });
}

export interface RawGeography {
  handle: string;
  fips?: string;
  name: string;
  shortName?: string;
}

export async function listGeographiesForSeries(
  seriesId: number,
): Promise<RawGeography[]> {
  const data = await uheroFetch<RawGeography[]>("/series/siblings/geo", {
    id: seriesId,
  });
  return Array.isArray(data) ? data : [];
}

export interface RawCategory {
  id: number;
  name: string;
  parent?: number;
  defaults?: { geo?: string; freq?: string };
}

export async function listCategories(): Promise<RawCategory[]> {
  const data = await uheroFetch<RawCategory[]>("/category");
  return Array.isArray(data) ? data : [];
}

export async function getCategorySeries(
  categoryId: number,
  geo?: string,
  freq?: Frequency,
): Promise<RawSeries[]> {
  const data = await uheroFetch<RawSeries[]>("/category/series", {
    id: categoryId,
    geo,
    freq,
  });
  return Array.isArray(data) ? data : [];
}

export async function getSeriesSiblings(id: number): Promise<RawSeries[]> {
  const data = await uheroFetch<RawSeries[]>("/series/siblings", { id });
  return Array.isArray(data) ? data : [];
}

export function normalizeObservations(
  raw: RawObservations,
): ObservationPoint[] {
  const first = raw.transformationResults?.[0];
  if (!first) return [];
  const dates = first.dates ?? [];
  const values = first.values ?? [];
  const out: ObservationPoint[] = [];
  for (let i = 0; i < dates.length; i++) {
    const v = values[i];
    let num: number | null = null;
    if (typeof v === "number" && Number.isFinite(v)) num = v;
    else if (typeof v === "string" && v.trim() !== "") {
      const parsed = Number(v);
      num = Number.isFinite(parsed) ? parsed : null;
    }
    out.push({ date: dates[i], value: num });
  }
  return out;
}
