/**
 * Server-side loader: fetch a category's series at one frequency and align
 * them on a single date grid (every period from the earliest observation to
 * the latest), so the client can index all series by the same slider index.
 */
import { fetchKauaiSeries } from "@/actions/data-portal/kauai";
import { createDateArray } from "@/app/data/[universe]/lib/dates";
import type { DateEntry, FreqCode } from "@/app/data/[universe]/lib/types";

import { categorySeriesNames, findNode } from "./categories";
import type { Category } from "./categories";

export interface DashboardSeries {
  name: string;
  label: string;
  /** Short label for chart axes / legends. */
  short: string;
  units: string;
  unitsShort: string;
  decimals: number;
  percent: boolean;
  source: string | null;
  /** Aligned to DashboardData.dates; null = no observation. */
  lvl: (number | null)[];
  pc1: (number | null)[];
  ytd: (number | null)[];
  /** First / last index with a level value (-1 when none). */
  first: number;
  last: number;
}

export interface DashboardData {
  freq: FreqCode;
  dates: DateEntry[];
  /** Keyed by series name without frequency; null = not available at this freq. */
  series: Record<string, DashboardSeries | null>;
}

export async function loadCategoryData(
  cat: Category,
  freq: FreqCode,
): Promise<DashboardData> {
  const names = categorySeriesNames(cat);
  const raw = await fetchKauaiSeries(names, freq);

  let start = "";
  let end = "";
  for (const s of Object.values(raw)) {
    for (const d of Object.keys(s?.lvl ?? {})) {
      if (!start || d < start) start = d;
      if (!end || d > end) end = d;
    }
  }
  const dates = start ? createDateArray(start, end, freq) : [];

  const series: Record<string, DashboardSeries | null> = {};
  for (const name of names) {
    const s = raw[name];
    const node = findNode(cat, name);
    const lvl = s ? dates.map((d) => s.lvl[d.date] ?? null) : [];
    if (!s || !node || !lvl.some((v) => v !== null)) {
      series[name] = null;
      continue;
    }
    series[name] = {
      name,
      label: node.label,
      short: node.short ?? node.label,
      units: s.units,
      unitsShort: s.unitsShort,
      decimals: s.decimals,
      percent: s.percent,
      source: s.source,
      lvl,
      pc1: dates.map((d) => s.pc1[d.date] ?? null),
      ytd: dates.map((d) => s.ytd[d.date] ?? null),
      first: lvl.findIndex((v) => v !== null),
      last: lvl.findLastIndex((v) => v !== null),
    };
  }

  return { freq, dates, series };
}
