/**
 * The flat DOTAX shape, shared by dotax_current and dotax_archive (and, in
 * its own words, dotax_sheet):
 *
 *   date, type, tax, source, area, amount, fiscal_year
 *
 *   type    the report, from the file name: collec, ge, liab_ge, liab_tat,
 *           fuels, liq, tob, liqtob
 *   tax     the heading a row sits under: Income-Ind., Distribution of
 *           Collections, Base, State Tax, ... A row without a heading is
 *           its own tax (collec "Conveyance": tax = source = Conveyance).
 *   source  the row label as printed (its latest spelling), numbered when
 *           a label repeats within a table (SUB-TOTAL 1, SUB-TOTAL 2)
 *   area    State, Honolulu, Maui, Hawaii, Kauai, Unknown
 *
 * Load statements pass the same values, area optional (default State):
 *
 *   Series.load_from_dotax_current("collec", "Income-Ind.", "Refunds", "State")
 *   Series.load_from_dotax_archive("ge", "Base", "Retailing", "Maui")
 *
 * Any spelling DOTAX has used works: tax and area through the alias tables
 * below, source through the parser's label rules (config/labels). Output
 * rows and arguments both resolve to the parser's coordinates
 * report|section|sub|item|geo, which is the lookup key, so a relabelled
 * row stays one series.
 */

import { compact } from "../keys";
import { KEY_SEP } from "../tidy";
import type { OutputLayout, ResolvedKey } from "../types";
import { cleanLabel, matchItem } from "./parse";
import type { ParsedRow, ReportType } from "./parse";

export const DOTAX_LAYOUT: OutputLayout = {
  columns: ["date", "type", "tax", "source", "area", "amount", "fiscal_year"],
  keyColumns: ["type", "tax", "source", "area"],
  valueColumn: "amount",
};

export function reportKey(
  type: string,
  section: string,
  sub: string,
  item: string,
  geo: string,
): string {
  return `${type}|${section}|${sub}|${item}|${geo}`;
}

/** Fiscal year (ending June 30) of a YYYY-MM month, e.g. 2025-07 → 2026. */
export function fiscalYear(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return String(m >= 7 ? y + 1 : y);
}

const REPORTS: Record<string, ReportType> = {
  collec: "collec",
  coll: "collec",
  collall: "collec",
  collections: "collec",
  ge: "ge",
  generalexcise: "ge",
  liabge: "liab_ge",
  geliability: "liab_ge",
  liabtat: "liab_tat",
  tatliability: "liab_tat",
  fuels: "fuels",
  fuel: "fuels",
  liqtob: "liqtob",
  liq: "liq",
  liquor: "liq",
  tob: "tob",
  tobacco: "tob",
};

type Tax = {
  /** section written by the parser */
  section: string;
  sub?: string;
  /** label-rule section (fuels rules are keyed base / alloc) */
  ruleSection?: string;
};

/** Accepted tax headings per report (compacted: letters + digits only). */
const TAXES: Record<ReportType, Record<string, Tax>> = {
  collec: {
    sourceofrevenue: { section: "collections" },
    collections: { section: "collections" },
    incomecorp: { section: "collections", sub: "corp" },
    incomecorporation: { section: "collections", sub: "corp" },
    corporateincome: { section: "collections", sub: "corp" },
    corporation: { section: "collections", sub: "corp" },
    incomeind: { section: "collections", sub: "ind" },
    incomeindividual: { section: "collections", sub: "ind" },
    individualincome: { section: "collections", sub: "ind" },
    individual: { section: "collections", sub: "ind" },
    distributionofcollections: { section: "distribution" },
    distribution: { section: "distribution" },
    countysurcharges: { section: "county_surcharge" },
    countysurcharge: { section: "county_surcharge" },
    othercountyrevenue: { section: "county_revenue" },
    countyrevenue: { section: "county_revenue" },
    total: { section: "grand_total" },
    grandtotal: { section: "grand_total" },
  },
  ge: activityTaxes(),
  liab_ge: activityTaxes(),
  liab_tat: activityTaxes(),
  fuels: {
    gallons: { section: "base_gallons", ruleSection: "base" },
    basegallons: { section: "base_gallons", ruleSection: "base" },
    statetax: { section: "base_state", ruleSection: "base" },
    countytax: { section: "base_county", ruleSection: "base" },
    totaltax: { section: "base_total", ruleSection: "base" },
    basetotal: { section: "base_total", ruleSection: "base" },
    allocationamount: { section: "alloc_amount", ruleSection: "alloc" },
    amount: { section: "alloc_amount", ruleSection: "alloc" },
    allocationtotal: { section: "alloc_total", ruleSection: "alloc" },
    allocation: { section: "alloc_total", ruleSection: "alloc" },
  },
  liqtob: liqtobTaxes(),
  liq: liqtobTaxes(),
  tob: liqtobTaxes(),
};

function activityTaxes(): Record<string, Tax> {
  return {
    collections: { section: "collections" },
    taxcollections: { section: "collections" },
    base: { section: "base" },
    taxbase: { section: "base" },
    liability: { section: "liability" },
    liabilities: { section: "liability" },
    taxliability: { section: "liability" },
    taxliabilities: { section: "liability" },
  };
}

function liqtobTaxes(): Record<string, Tax> {
  return {
    liquor: { section: "liquor" },
    liquortax: { section: "liquor" },
    tobacco: { section: "tobacco" },
    tobaccotax: { section: "tobacco" },
  };
}

/** Tax heading written to the output, by parser section (and sub). */
const TAX_NAMES: Record<string, string> = {
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

const AREAS: Record<string, string> = {
  state: "HI",
  statewide: "HI",
  stateofhawaii: "HI",
  alldistricts: "HI",
  allcounties: "HI",
  summary: "HI",
  statetotal: "HI",
  hi: "HI",
  oahu: "HON",
  honolulu: "HON",
  firstdistrict: "HON",
  first: "HON",
  ccofhonolulu: "HON",
  candcofhonolulu: "HON",
  cityandcountyofhonolulu: "HON",
  cityampcountyofhonolulu: "HON",
  hon: "HON",
  maui: "MAU",
  countyofmaui: "MAU",
  seconddistrict: "MAU",
  second: "MAU",
  mau: "MAU",
  hawaii: "HAW",
  hawaiicounty: "HAW",
  countyofhawaii: "HAW",
  thirddistrict: "HAW",
  third: "HAW",
  haw: "HAW",
  kauai: "KAU",
  countyofkauai: "KAU",
  fourthdistrict: "KAU",
  fourth: "KAU",
  kau: "KAU",
  unknown: "UNK",
  unknowndistrict: "UNK",
  unk: "UNK",
};

export const AREA_NAMES: Record<string, string> = {
  HI: "State",
  HON: "Honolulu",
  MAU: "Maui",
  HAW: "Hawaii",
  KAU: "Kauai",
  UNK: "Unknown",
};

export function areaCode(area: unknown): string | null {
  return AREAS[compact(area)] ?? null;
}

/** "SUB-TOTAL 2" / "SUB-TOTAL (2)" → 2 */
function subtotalNumber(label: string): number | null {
  const m = label.match(/SUB-?\s*TOTAL\s*\(?(\d)\)?\s*$/i);
  return m ? Number(m[1]) : null;
}

/**
 * Output columns for a parsed row: the tax heading, the source label
 * (`label` = the spelling to print, normally the latest) and the area.
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
  // "|" joins the key columns
  const clean = (s: string) => s.replace(/\|/g, "/");
  return { tax: clean(tax), source: clean(source), area };
}

/**
 * (type, tax, source, area?) → report|section|sub|item|geo. Throws with a
 * message naming the accepted values when an argument does not resolve.
 */
export function dotaxKeyFromArgs(method: string, args: unknown[]): ResolvedKey {
  const call = `${method}(${args
    .filter((a) => a !== undefined)
    .map((a) => JSON.stringify(a))
    .join(", ")})`;
  const given = args.filter((a) => a !== undefined && a !== null);
  if (
    given.length < 3 ||
    given.length > 4 ||
    given.some((a) => typeof a !== "string")
  ) {
    throw new Error(
      `${call}: expects type, tax, source and optionally area, as strings (e.g. "collec", "Income-Ind.", "Refunds", "State")`,
    );
  }
  const [typeArg, taxArg, sourceArg, areaArg = "State"] = given as string[];

  const report = REPORTS[compact(typeArg)];
  if (!report) {
    throw new Error(
      `${call}: unknown type "${typeArg}" (one of collec, ge, liab_ge, liab_tat, fuels, liq, tob, liqtob)`,
    );
  }
  const geo = areaCode(areaArg);
  if (!geo) {
    throw new Error(
      `${call}: unknown area "${areaArg}" (State, Honolulu, Maui, Hawaii, Kauai, Unknown — or as printed: Oahu, All Districts, First District, ...)`,
    );
  }

  const label = cleanLabel(sourceArg);
  const isTotal = /^TOTAL$/i.test(label);
  let tax: Tax | undefined;
  let item: string | null = null;
  if (report === "collec" && compact(taxArg) === compact(sourceArg)) {
    // a row with no heading is its own tax; the final TOTAL is one too
    tax = isTotal ? { section: "grand_total" } : { section: "collections" };
  } else {
    tax = TAXES[report][compact(taxArg)];
  }
  if (!tax) {
    const known = [
      ...new Set(
        Object.values(TAXES[report]).map(
          (t) => TAX_NAMES[t.sub ? `${t.section}|${t.sub}` : t.section] ?? "",
        ),
      ),
    ].filter(Boolean);
    throw new Error(
      `${call}: unknown ${report} tax "${taxArg}" (one of: ${known.join(", ")}${report === "collec" ? "; or the source itself for a row with no heading" : ""})`,
    );
  }

  let section = tax.section;
  const sub = tax.sub ?? "";
  if (
    report === "collec" &&
    section === "collections" &&
    !sub &&
    /^TOTAL\b/i.test(label)
  ) {
    // the "TOTAL - <month>" row under SOURCE OF REVENUE
    section = "coll_total";
    item = "total";
  } else if (report === "collec" && section === "county_surcharge" && isTotal) {
    item = "county_surcharges";
  } else {
    const ruleType =
      report === "liab_tat"
        ? "liab_tat"
        : report === "liab_ge"
          ? "ge"
          : report === "liq" || report === "tob"
            ? "liqtob"
            : report;
    item = matchItem(label, ruleType, tax.ruleSection ?? section, sub);
    // A canonical item name works too ("ind_refunds", "subtotal2").
    if (item === null && /^[a-z0-9_]+$/.test(sourceArg.trim()))
      item = sourceArg.trim();
    if (item === "subtotal" && report !== "collec") {
      item = `subtotal${subtotalNumber(sourceArg) ?? 1}`;
    }
  }
  if (item === null) {
    throw new Error(
      `${call}: source "${sourceArg}" is not recognized for ${report} / ${taxArg} — check the spelling against the DOTAX file, or add a label rule`,
    );
  }
  if (item === "ignore") {
    throw new Error(
      `${call}: "${sourceArg}" is a heading, not a row with values — pass it as the tax`,
    );
  }
  return {
    key: reportKey(report, section, sub, item, geo),
    frequency: "M",
    label: `${report} / ${taxArg} / "${sourceArg}" / ${areaArg}`,
  };
}

/** Output row key (type|tax|source|area) → lookup key, or null. */
export function dotaxIndexKey(rowKey: string): string | null {
  try {
    return dotaxKeyFromArgs("", rowKey.split(KEY_SEP)).key;
  } catch {
    return null;
  }
}
