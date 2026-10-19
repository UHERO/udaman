"use server";

/***************************************************************************************
 *  Kauaʻi Economic Dashboard (/data/kauai) — REST API access.
 *
 *  Series are fetched by name from the UNRESTRICTED API (`/v1.u`): seven of
 *  the dashboard's series (YPC_R, YL_NF_R, KPPRVRSD_R, E_TTU, E_PBS, E_EDHC,
 *  RNS) are restricted and absent from the public `/v1`. Base URL is
 *  REST_API_V1U_URL, else REST_API_V1_URL + ".u"
 *  (https://api.uhero.hawaii.edu/v1 → …/v1.u).
 *
 *  An unknown name comes back as `{series: {id: 0}}` — returned here as null
 *  so the dashboard can show "not available" for that row instead of failing.
 ***************************************************************************************/
import type { FreqCode } from "@/app/data/[universe]/lib/types";

import { fetchFromRestApi } from "./cpi-rpp";

const BASE_URL =
  process.env.REST_API_V1U_URL ??
  (process.env.REST_API_V1_URL ? `${process.env.REST_API_V1_URL}.u` : "");

interface ApiTransformation {
  transformation: string;
  dates?: string[];
  values?: string[];
}

interface ApiSeriesResponse {
  series: {
    id: number;
    name: string;
    title?: string;
    unitsLabel: string;
    unitsLabelShort: string;
    decimals?: number;
    percent?: boolean;
    sourceDescription?: string;
    sourceLink?: string;
  };
  observations?: {
    observationStart: string;
    observationEnd: string;
    transformationResults?: ApiTransformation[];
  };
}

/** One series at one frequency, observations keyed by period start date. */
export interface KauaiSeriesData {
  /** Full udaman name, e.g. "E_NF@KAU.Q". */
  name: string;
  title: string;
  units: string;
  unitsShort: string;
  decimals: number;
  /** Rate series: pc1/ytd are changes in points, not % changes. */
  percent: boolean;
  source: string | null;
  sourceLink: string | null;
  /** "YYYY-MM-DD" → value, per transformation. */
  lvl: Record<string, number>;
  pc1: Record<string, number>;
  ytd: Record<string, number>;
}

function toMap(t: ApiTransformation | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!t?.dates || !t.values) return out;
  t.dates.forEach((d, i) => {
    const v = +t.values![i];
    if (t.values![i] !== "" && Number.isFinite(v)) out[d.slice(0, 10)] = v;
  });
  return out;
}

/** GET /series?name=&u=uhero&expand=raw on /v1.u; null when not found. */
async function fetchOne(name: string): Promise<KauaiSeriesData | null> {
  const res = await fetchFromRestApi<ApiSeriesResponse>({
    baseUrl: BASE_URL,
    resource: "series",
    params: { u: "uhero", name, expand: "raw" },
  });
  const s = res?.series;
  if (!s?.id) return null;
  const results = res.observations?.transformationResults ?? [];
  const pick = (k: string) => results.find((t) => t.transformation === k);
  return {
    name: s.name,
    title: s.title ?? s.name,
    units: s.unitsLabel ?? "",
    unitsShort: s.unitsLabelShort ?? "",
    decimals: s.decimals ?? 1,
    percent: !!s.percent,
    source: s.sourceDescription || null,
    sourceLink: s.sourceLink || null,
    lvl: toMap(pick("lvl")),
    pc1: toMap(pick("pc1")),
    ytd: toMap(pick("ytd")),
  };
}

/**
 * Fetch `bases` (names without the frequency suffix, e.g. "E_NF@KAU") at
 * `freq`, in parallel. Missing series and failed requests map to null (a
 * failure is logged, not thrown, so one bad series doesn't blank the page).
 */
export async function fetchKauaiSeries(
  bases: string[],
  freq: FreqCode,
): Promise<Record<string, KauaiSeriesData | null>> {
  const entries = await Promise.all(
    bases.map(async (base) => {
      try {
        return [base, await fetchOne(`${base}.${freq}`)] as const;
      } catch (e) {
        console.error(`kauai dashboard: fetch failed for ${base}.${freq}`, e);
        return [base, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
