/**
 * EIA Open Data API v2 (AEO, STEO and any other route with a seriesId facet).
 *
 *   Series.load_from_extract("eia", { route: "aeo/2025", scenario: "ref2025", series_id: "prce_NA_NA_NA_cr_wti_usa_ndlrpbrl" })
 *   Series.load_from_extract("eia", { route: "steo", series_id: "WTIPUUS" })
 *
 * Downloader `eia` (strategy custom) makes one request per route and
 * frequency for every series id and scenario its load statements name,
 * and stores one artifact per series, `<route>/<scenario>/<series id>/<freq>`
 * (fetch.ts); the `eia` extractor reads the newest vintage of each
 * (parse.ts). Dimensions: route, scenario ("-" for routes without
 * scenarios, e.g. steo), series_id, frequency (from the target series'
 * name when the load statement omits it).
 */

import type { SourceModule } from "../../types";
import { fetchEia } from "./fetch";
import { parseEia } from "./parse";

export const eiaSource: SourceModule = {
  key: "eia",
  description: "EIA API v2 (routes and series from the load statements)",
  label: "EIA",
  describeSeries: (d) =>
    !d.series_id
      ? ""
      : d.scenario && d.scenario !== "-"
        ? `${d.series_id} (${d.scenario})`
        : d.series_id,
  sourceUrl: (d) =>
    d.route ? `https://www.eia.gov/opendata/browser/${d.route}` : null,
  version: 1,
  fetchesReferencedFilters: true,
  fetch: fetchEia,
  dimensions: () => ["route", "scenario", "series_id", "frequency"],
  parse: (inputs) => parseEia(inputs),
};
