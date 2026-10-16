/**
 * BEA API (GetData), datasets Regional and NIPA.
 *
 *   Series.load_from_extract("bea", { dataset: "Regional", table: "CAINC5N", line: "201", geo: "15007" })
 *   Series.load_from_extract("bea", { dataset: "NIPA", table: "T10105", line: "1" })
 *
 * Downloader `bea` (strategy custom) makes one request per Regional
 * (table, geo) — every line — and one per NIPA table — every line and
 * frequency — and stores one artifact per series its load statements ask
 * for, `<dataset>/<table>/<line>/<geo>/<freq>` (fetch.ts); the `bea`
 * extractor reads the newest vintage of each (parse.ts). Dimensions:
 * dataset, table, line (Regional LineCode / NIPA LineNumber), geo
 * (GeoFips; "-" for NIPA), frequency (from the TimePeriod; taken from the
 * target series' name when the load statement omits it).
 */

import type { SourceModule } from "../../types";
import { fetchBea } from "./fetch";
import { parseBea } from "./parse";

export const beaSource: SourceModule = {
  key: "bea",
  description: "BEA API, Regional and NIPA (series from the load statements)",
  label: "BEA",
  describeSeries: (d) =>
    d.table && d.line
      ? `${d.table} line ${d.line}${d.geo && d.geo !== "-" ? ` for GeoFips ${d.geo}` : ""}`
      : "",
  sourceUrl: (d) =>
    d.dataset === "NIPA"
      ? "https://apps.bea.gov/iTable/?reqid=19&step=2&isuri=1&categories=survey"
      : "https://apps.bea.gov/itable/?ReqID=70&step=1",
  version: 1,
  fetchesReferencedFilters: true,
  fetch: fetchBea,
  dimensions: () => ["dataset", "table", "line", "geo", "frequency"],
  parse: (inputs) => parseBea(inputs),
};
