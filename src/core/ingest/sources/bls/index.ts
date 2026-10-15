/**
 * BLS v2 API.
 *
 *   Series.load_from_extract("bls", { series_id: "CUSR0000SA0" })
 *
 * Downloader `bls` (strategy custom, config { refetchYears?: 20,
 * extraIds?: string[] }) stores one artifact per series and window
 * (fetch.ts); the `bls` extractor reads every vintage (parse.ts).
 * Dimensions: series_id, frequency (from the BLS period codes).
 */

import type { SourceModule } from "../../types";
import { fetchBls } from "./fetch";
import { parseBls } from "./parse";

export const blsSource: SourceModule = {
  key: "bls",
  description: "BLS v2 API (series IDs from the load statements)",
  label: "BLS",
  nameDimensions: ["series_id"],
  sourceUrl: (d) =>
    `https://data.bls.gov/timeseries/${encodeURIComponent(d.series_id)}`,
  version: 1,
  inputVintages: "all",
  fetchesReferencedFilters: true,
  fetch: fetchBls,
  dimensions: () => ["series_id", "frequency"],
  parse: (inputs) => parseBls(inputs),
};
