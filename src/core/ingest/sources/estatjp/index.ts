/**
 * Japan e-Stat API 3.0 (monthly series).
 *
 *   Series.load_from_extract("estatjp", { stats_data_id: "0003005798", tab: "01", cat01: "000", cat02: "08", cat03: "0", area: "00000" })
 *
 * Downloader `estatjp` (strategy custom) asks each table once for every
 * code its load statements name and stores one artifact per series,
 * `<statsDataId>/<class>=<code>,…` (fetch.ts); the `estatjp` extractor
 * reads the newest vintage of each (parse.ts). Dimensions: stats_data_id
 * and the classifications tab, cat01, cat02, cat03, area (e-Stat's codes);
 * a classification the table does not have is "-". Monthly periods only,
 * like load_api_estatjp.
 */

import type DataExtractor from "@catalog/models/data-extractor";

import type { SourceModule } from "../../types";
import { fetchEstat } from "./fetch";
import { parseEstat } from "./parse";

export const ESTAT_CLASSES = ["tab", "cat01", "cat02", "cat03", "area"];

/** The classification dims: config.classes overrides the default list. */
export function estatClasses(extractor: DataExtractor): string[] {
  const c = extractor.config.classes;
  return Array.isArray(c) && c.length ? c.map(String) : ESTAT_CLASSES;
}

export const estatjpSource: SourceModule = {
  key: "estatjp",
  description: "Japan e-Stat API (tables and codes from the load statements)",
  label: "e-Stat",
  describeSeries: ({ stats_data_id, frequency: _, ...codes }) =>
    stats_data_id
      ? `table ${stats_data_id} (${Object.entries(codes)
          .filter(([, v]) => v !== "-")
          .map(([k, v]) => `${k} ${v}`)
          .join(", ")})`
      : "",
  sourceUrl: (d) =>
    d.stats_data_id
      ? `https://www.e-stat.go.jp/en/dbview?sid=${encodeURIComponent(d.stats_data_id)}`
      : null,
  version: 1,
  frequency: "M",
  fetchesReferencedFilters: true,
  fetch: fetchEstat,
  dimensions: (extractor) => ["stats_data_id", ...estatClasses(extractor)],
  parse: (inputs, ctx) => parseEstat(inputs, estatClasses(ctx.extractor)),
};
