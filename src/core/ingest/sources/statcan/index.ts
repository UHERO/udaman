/**
 * Statistics Canada Web Data Service (WDS), by vector.
 *
 *   Series.load_from_extract("statcan", { series_id: "v2062810" })
 *
 * The id is the vector as StatCan prints it on every series ("v" + digits);
 * a table and coordinate can be turned into one with WDS
 * getSeriesInfoFromCubePidCoord.
 *
 * Downloader `statcan` (strategy custom, config { fullRefreshDays?: 90 })
 * stores two artifacts per vector, `<vector>/full` (the whole history,
 * once and then every fullRefreshDays) and `<vector>/updates` (every
 * point released since the last full pull, revisions included) (fetch.ts);
 * the `statcan` extractor merges the newest vintage of each, latest
 * release winning (parse.ts). Dimensions: series_id, frequency (from
 * WDS's frequencyCode, or the dates when that code is irregular; taken
 * from the target series' name when the load statement omits it).
 * Values are as published — the scalar factor (thousands, millions) is
 * not applied; it is in the extraction stats and the artifact metadata.
 */

import type { SourceModule } from "../../types";
import { fetchStatcan } from "./fetch";
import { parseStatcan } from "./parse";

export const statcanSource: SourceModule = {
  key: "statcan",
  description: "Statistics Canada WDS (vectors from the load statements)",
  label: "Statistics Canada",
  nameDimensions: ["series_id"],
  sourceUrl: (d) =>
    d.series_id
      ? `https://www150.statcan.gc.ca/t1/tbl1/en/sbv.action?vectorNumbers=${encodeURIComponent(d.series_id)}`
      : null,
  version: 1,
  fetchesReferencedFilters: true,
  fetch: (ctx) => fetchStatcan(ctx),
  dimensions: () => ["series_id", "frequency"],
  parse: (inputs) => parseStatcan(inputs),
};
