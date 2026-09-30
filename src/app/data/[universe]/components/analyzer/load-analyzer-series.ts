/**
 * Server-side loader shared by the analyzer page and the /graph embed:
 * package/analyzer, ordered like the requested ids (palette slots follow the
 * order series were added), plus package/analyzermom merged in when the
 * analyzer frequency is M/W/D (analyzer.getAnalyzerData + addMoMTransformation).
 */
import {
  fetchAnalyzerMom,
  fetchAnalyzerPackage,
} from "@/actions/data-portal/portal";

import { allowMoM, mergeMomSeries } from "../../lib/analyzer";
import type { ExpandedSeries } from "../../lib/types";
import { analyzerBase } from "./analyzer-model";

export async function loadAnalyzerSeries(opts: {
  universe: string;
  ids: number[];
  noCache?: boolean;
}): Promise<ExpandedSeries[]> {
  const { universe, ids, noCache } = opts;
  if (!ids.length) return [];
  const pkg = await fetchAnalyzerPackage({ universe, ids, noCache });
  const byId = new Map<number, ExpandedSeries>();
  for (const s of pkg.series ?? []) if (!byId.has(s.id)) byId.set(s.id, s);
  let series = [
    ...ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
    ...[...byId.values()].filter((s) => !ids.includes(s.id)),
  ];
  const freq = analyzerBase(series).freq?.freq;
  if (allowMoM(freq)) {
    try {
      const mom = await fetchAnalyzerMom({ universe, ids, noCache });
      series = mergeMomSeries(series, mom.series ?? []);
    } catch {
      // MOM is optional — the analyzer still works without it.
    }
  }
  return series;
}
