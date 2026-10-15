/**
 * FRED (St. Louis Fed) API v1.
 *
 *   Series.load_from_extract("fred", { series_id: "MORTGAGE30US", aggregation: "avg" })
 *
 * Downloader `fred` (strategy custom, config { extraFilters?: [{ series_id,
 * frequency, aggregation? }] }) stores one artifact per series, frequency
 * and aggregation, `<series id>/<freq>/<aggregation>` (fetch.ts); the
 * `fred` extractor reads the newest vintage of each (parse.ts).
 * Dimensions: series_id, frequency (as requested — FRED aggregates to it
 * server side), aggregation (avg | sum | eop; FRED's default avg when the
 * load statement omits it). The frequency may be left out of the load
 * statement: it is taken from the target series' name.
 */

import type { SourceModule } from "../../types";
import { fetchFred } from "./fetch";
import { parseFred } from "./parse";

export const fredSource: SourceModule = {
  key: "fred",
  description: "FRED API (series from the load statements)",
  label: "FRED",
  nameDimensions: ["series_id"],
  sourceUrl: (d) =>
    `https://fred.stlouisfed.org/series/${encodeURIComponent(d.series_id)}`,
  version: 1,
  fetchesReferencedFilters: true,
  fetch: fetchFred,
  dimensions: () => ["series_id", "frequency", "aggregation"],
  parse: (inputs) => parseFred(inputs),
};
