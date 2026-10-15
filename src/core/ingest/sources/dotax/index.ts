/**
 * DOTAX monthly tax reports (tax.hawaii.gov).
 *
 *   Series.load_from_extract("dotax", { type: "collec", tax: "Income-Ind.", source: "Refunds", area: "State" })
 *
 * Downloaders (strategy custom, source_key "dotax"): dotax_current
 * ({ kind: "current" }) and dotax_archive ({ kind: "archive" }). The
 * `dotax` extractor reads both. Dimensions:
 *   type   report: collec, ge, liab_ge, liab_tat, fuels, liq, tob, liqtob
 *   tax    the heading a row sits under (a collec row with no heading is
 *          its own tax); fuels: the value column
 *   source the row's fixed label (./canonical)
 *   area   State, Honolulu, Maui, Hawaii, Kauai, Unknown
 */

import { sha256 } from "../../raw-store";
import type { SourceModule } from "../../types";
import { configFingerprint } from "./config";
import { fetchDotax } from "./fetch";
import { DOTAX_DIMS, parseDotaxReports } from "./parse";

/**
 * Bump when the parser code changes; the label rules, known issues and
 * fixed labels (config/) are hashed in automatically.
 */
const PARSER_VERSION = 2;

export const dotaxSource: SourceModule = {
  key: "dotax",
  description: "DOTAX monthly tax reports (current page XLSX + archive zips)",
  label: "DOTAX",
  nameDimensions: ["tax", "source", "area"],
  get version() {
    return Number.parseInt(
      sha256(`${PARSER_VERSION}|${configFingerprint()}`).slice(0, 8),
      16,
    );
  },
  frequency: "M",
  fetch: fetchDotax,
  dimensions: () => DOTAX_DIMS,
  parse: (inputs, ctx) => parseDotaxReports(inputs, ctx.log),
};
