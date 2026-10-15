/**
 * How a parsed DOTAX row is printed in the extract:
 *
 *   type   the report: collec, ge, liab_ge, liab_tat, fuels, liq, tob, liqtob
 *   tax    the heading the row sits under (TAX_NAMES); a collec row with no
 *          heading is its own tax; fuels: the value column
 *   source the row's fixed label (config/canonical), whatever spelling the
 *          file printed — every spelling resolves to one item through the
 *          label rules (config/labels), and the item has one fixed label
 *   area   State, Honolulu, Maui, Hawaii, Kauai, Unknown
 */

import { parseCsvRecords } from "./config";
import { CANONICAL_CSV } from "./config/canonical";
import type { ParsedRow } from "./parse-reports";

/** The parser's coordinates of one series: type|section|sub|item|geo. */
export function reportKey(
  type: string,
  section: string,
  sub: string,
  item: string,
  geo: string,
): string {
  return `${type}|${section}|${sub}|${item}|${geo}`;
}

/** Tax heading written to the extract, by parser section (and sub). */
export const TAX_NAMES: Record<string, string> = {
  "collections|corp": "Income-Corp.",
  "collections|ind": "Income-Ind.",
  coll_total: "Source of Revenue",
  distribution: "Distribution of Collections",
  county_surcharge: "County Surcharges",
  county_revenue: "Other County Revenue",
  base: "Base",
  liability: "Liability",
  base_gallons: "Gallons",
  base_state: "State Tax",
  base_county: "County Tax",
  base_total: "Total Tax",
  alloc_amount: "Allocation Amount",
  alloc_total: "Allocation Total",
  liquor: "Liquor",
  tobacco: "Tobacco",
};

export const AREA_NAMES: Record<string, string> = {
  HI: "State",
  HON: "Honolulu",
  MAU: "Maui",
  HAW: "Hawaii",
  KAU: "Kauai",
  UNK: "Unknown",
};

let fixed: Map<string, string> | null = null;

/** The fixed `source` label of an item, or null when it has none yet. */
export function fixedLabel(
  type: string,
  section: string,
  sub: string,
  item: string,
): string | null {
  fixed ??= new Map(
    parseCsvRecords(CANONICAL_CSV).map((r) => [
      `${r.type}|${r.section}|${r.sub}|${r.item}`,
      r.source,
    ]),
  );
  return fixed.get(`${type}|${section}|${sub}|${item}`) ?? null;
}

/**
 * Printed columns for a parsed row: the tax heading, the source label
 * (`label` = the fixed label, or the printed one when the item has none)
 * and the area.
 */
export function dotaxDisplay(
  r: Pick<ParsedRow, "type" | "section" | "sub" | "item" | "geo">,
  label: string,
): { tax: string; source: string; area: string } {
  const area = AREA_NAMES[r.geo] ?? r.geo;
  const numbered = r.item.match(/^subtotal(\d)$/);
  let source = numbered ? `SUB-TOTAL ${numbered[1]}` : label;
  let tax = TAX_NAMES[r.sub ? `${r.section}|${r.sub}` : r.section];
  if (r.type === "collec") {
    if (r.section === "coll_total") source = "TOTAL";
    else if (r.section === "county_surcharge" && r.item === "county_surcharges")
      // the COUNTY SURCHARGES heading row carrying the section total
      source = "TOTAL";
    else if (r.section === "grand_total") tax = source = "TOTAL";
    else if (r.section === "collections" && !r.sub) tax = source;
  }
  if (tax === undefined) {
    // activity reports' first block, typed "collections" (no fixed name
    // clash with collec, which is handled above)
    tax = r.section === "collections" ? "Collections" : r.section;
  }
  return { tax, source, area };
}
