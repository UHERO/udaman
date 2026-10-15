/**
 * The "DOTAX Collections Portal Export Data" Google Sheet: preliminary
 * statewide collections, usually weeks or months ahead of the report
 * spreadsheets. Port of rprocess dotax_collec.R.
 *
 *   Series.load_from_extract("dotax_sheet", { type: "Collection", tax: "General Excise", source: "General Excise & Use" })
 *
 * Downloader `dotax_sheet` (fetch.ts), extractor `dotax_sheet`
 * (parse.ts). Dimensions: type, tax, source (statewide only).
 */

import type { SourceModule } from "../../types";
import { fetchSheet } from "./fetch";
import { parseSheet } from "./parse";

export const dotaxSheetSource: SourceModule = {
  key: "dotax_sheet",
  description: "DOTAX Collections Portal Export Data (Google Sheet)",
  label: "DOTAX",
  nameDimensions: ["tax", "source"],
  version: 1,
  frequency: "M",
  fetch: fetchSheet,
  dimensions: () => ["type", "tax", "source"],
  parse: (inputs) => parseSheet(inputs),
};
