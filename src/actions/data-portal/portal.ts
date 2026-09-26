"use server";

/***************************************************************************************
 *  Public data portal (/data/[universe]) — REST API access.
 *
 *  One function per endpoint of the Angular ApiService
 *  (tmp/data-portal/projects/shared/services/api.service.ts). Every function
 *  takes the universe explicitly; ids are numbers; `noCache` appends the
 *  API's `nocache` flag. Response shapes were verified against
 *  api.uhero.hawaii.edu/v1 on 2026-09-25 — see
 *  src/app/data/[universe]/lib/types.ts and docs/data-portal-port.md.
 *
 *  All functions return the API's `data` payload (fetchFromRestApi unwraps
 *  it) and THROW ExternalServiceError on network / HTTP / JSON failures —
 *  callers decide whether to render an error state.
 ***************************************************************************************/
import { buildCategoryTree } from "@/app/data/[universe]/lib/category";
import type {
  AnalyzerPackage,
  ApiCategory,
  ExpandedSeries,
  Frequency,
  Geography,
  Measurement,
  PackageSearch,
  PortalCategories,
  PortalSeries,
  SearchSummary,
  SeriesObservations,
  SeriesPackage,
} from "@/app/data/[universe]/lib/types";

import { fetchFromRestApi } from "./cpi-rpp";

const BASE_URL = process.env.REST_API_V1_URL ?? "";

type Params = Record<string, string | number | boolean | null | undefined>;

async function get<T>(resource: string, params: Params, noCache = false) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    clean[k] = String(v);
  }
  if (noCache) clean.nocache = "";
  return fetchFromRestApi<T>({ baseUrl: BASE_URL, resource, params: clean });
}

/** API universe param. The API is case-insensitive; we send lowercase. */
const u = (universe: string) => universe.toLowerCase();

// ─── Categories ─────────────────────────────────────────────────────

/** GET /category?u= — flat list (root category itself is NOT included). */
export async function fetchCategoriesFlat(
  universe: string,
): Promise<ApiCategory[]> {
  return (
    (await get<ApiCategory[] | null>("category", { u: u(universe) })) ?? []
  );
}

/**
 * GET /category?u= → nav tree. `rootOverride` = config.rootCategory; the root
 * is otherwise derived (top-level = nodes whose parent isn't in the list).
 */
export async function fetchPortalCategories(
  universe: string,
  rootOverride?: number,
): Promise<PortalCategories> {
  return buildCategoryTree(await fetchCategoriesFlat(universe), rootOverride);
}

/** GET /category/geo?id= — geographies available for a data list. */
export async function fetchCategoryGeos(id: number): Promise<Geography[]> {
  return (await get<Geography[] | null>("category/geo", { id })) ?? [];
}

/** GET /category/freq?id= — frequencies available for a data list. */
export async function fetchCategoryFreqs(id: number): Promise<Frequency[]> {
  return (await get<Frequency[] | null>("category/freq", { id })) ?? [];
}

/** GET /category/fc?id= — forecast tags (FC universe), e.g. ["26Q1FF"]. */
export async function fetchCategoryForecasts(id: number): Promise<string[]> {
  return (await get<string[] | null>("category/fc", { id })) ?? [];
}

/**
 * GET /category/series?id=&geo=&freq=[&fc=]&u=&expand=true — every series in
 * a data list for one geo/freq, with observations.
 */
export async function fetchCategorySeries(opts: {
  universe: string;
  id: number;
  geo: string;
  freq: string;
  fc?: string | null;
  noCache?: boolean;
}): Promise<ExpandedSeries[]> {
  const { universe, id, geo, freq, fc, noCache } = opts;
  return (
    (await get<ExpandedSeries[] | null>(
      "category/series",
      { id, geo, freq, fc, u: u(universe), expand: "true" },
      noCache,
    )) ?? []
  );
}

/** GET /category/measurements?id= — NTA measurement list for a data list. */
export async function fetchCategoryMeasurements(
  id: number,
  noCache = false,
): Promise<Measurement[]> {
  return (
    (await get<Measurement[] | null>(
      "category/measurements",
      { id },
      noCache,
    )) ?? []
  );
}

/** GET /measurement/series?id=&expand=true — NTA series for a measurement. */
export async function fetchMeasurementSeries(
  id: number,
  noCache = false,
): Promise<ExpandedSeries[]> {
  return (
    (await get<ExpandedSeries[] | null>(
      "measurement/series",
      { id, expand: "true" },
      noCache,
    )) ?? []
  );
}

// ─── Series ─────────────────────────────────────────────────────────

/**
 * GET /package/series?id=&u=&cat= — series detail + observations + siblings
 * (+ forecasts on FC). `categoryId` is the data list the user came from.
 */
export async function fetchSeriesPackage(opts: {
  universe: string;
  id: number;
  categoryId?: number | null;
  noCache?: boolean;
}): Promise<SeriesPackage> {
  const { universe, id, categoryId, noCache } = opts;
  return get<SeriesPackage>(
    "package/series",
    { id, u: u(universe), cat: categoryId },
    noCache,
  );
}

/**
 * GET /series/siblings?id=&geo=&u= — the series' siblings (all freqs / SA
 * variants / geos). Used by the analyzer frequency switch.
 */
export async function fetchSeriesSiblings(opts: {
  universe: string;
  id: number;
  geo: string;
}): Promise<PortalSeries[]> {
  const { universe, id, geo } = opts;
  return (
    (await get<PortalSeries[] | null>("series/siblings", {
      id,
      geo,
      u: u(universe),
    })) ?? []
  );
}

/** GET /series/observations?id= */
export async function fetchSeriesObservations(
  id: number,
  noCache = false,
): Promise<SeriesObservations> {
  return get<SeriesObservations>("series/observations", { id }, noCache);
}

// ─── Search ─────────────────────────────────────────────────────────

/** GET /search?q=&u= — geos/freqs/defaults a term matches (no series). */
export async function fetchSearchSummary(opts: {
  universe: string;
  q: string;
  noCache?: boolean;
}): Promise<SearchSummary | null> {
  return get<SearchSummary | null>(
    "search",
    { q: opts.q, u: u(opts.universe) },
    opts.noCache,
  );
}

/** GET /search/series?q=&u= — matching series metadata (≤ 50, no obs). */
export async function fetchSearchSeries(opts: {
  universe: string;
  q: string;
  noCache?: boolean;
}): Promise<PortalSeries[]> {
  return (
    (await get<PortalSeries[] | null>(
      "search/series",
      { q: opts.q, u: u(opts.universe) },
      opts.noCache,
    )) ?? []
  );
}

/** GET /package/search?q=&u=&geo=&freq= — summary + expanded series. */
export async function fetchPackageSearch(opts: {
  universe: string;
  q: string;
  geo: string;
  freq: string;
  noCache?: boolean;
}): Promise<PackageSearch | null> {
  return get<PackageSearch | null>(
    "package/search",
    { q: opts.q, u: u(opts.universe), geo: opts.geo, freq: opts.freq },
    opts.noCache,
  );
}

// ─── Analyzer ───────────────────────────────────────────────────────

/** GET /package/analyzer?ids=1,2,3&u= — expanded series (lvl/pc1/ytd…). */
export async function fetchAnalyzerPackage(opts: {
  universe: string;
  ids: number[];
  noCache?: boolean;
}): Promise<AnalyzerPackage> {
  if (!opts.ids.length) return { categories: [], series: [] };
  return get<AnalyzerPackage>(
    "package/analyzer",
    { ids: opts.ids.join(","), u: u(opts.universe) },
    opts.noCache,
  );
}

/**
 * GET /package/analyzermom?ids=&u= — same shape, but each series'
 * transformationResults holds ONLY `mom`. Merge with mergeMomSeries().
 * Angular only calls this when the analyzer frequency is M/W/D.
 */
export async function fetchAnalyzerMom(opts: {
  universe: string;
  ids: number[];
  noCache?: boolean;
}): Promise<AnalyzerPackage> {
  if (!opts.ids.length) return { categories: [], series: [] };
  return get<AnalyzerPackage>(
    "package/analyzermom",
    { ids: opts.ids.join(","), u: u(opts.universe) },
    opts.noCache,
  );
}
