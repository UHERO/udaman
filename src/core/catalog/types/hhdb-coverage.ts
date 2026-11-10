/**
 * Shapes shared by the coverage / match-breakdown queries
 * (collections/hhdb-coverage-collection) and the Exploration charts.
 * Pure: safe to import from client components.
 */

/** Series keys, bottom of the stack first: counties by TMK digit, then no TMK. */
export const COVERAGE_SERIES = [
  "honolulu",
  "maui",
  "hawaii",
  "kauai",
  "no_tmk",
] as const;
export type CoverageSeries = (typeof COVERAGE_SERIES)[number];

export type CoverageGranularity = "year" | "month";

export type CoverageRow = {
  /** "YYYY" or "YYYY-MM". */
  period: string;
  total: number;
} & Record<CoverageSeries, number>;

export interface CoverageResult {
  /** The freq_ column_name the periods come from. */
  column: string;
  granularity: CoverageGranularity;
  rows: CoverageRow[];
  /** When freq_ was last rebuilt (ISO), or null when it is empty / missing. */
  generatedAt: string | null;
}

/** The match columns a breakdown chart can show. */
export type MatchColumn = "tmk_match" | "cpr_match";

/** County bars, then the statewide bar (the only one with a no-TMK share). */
export const BREAKDOWN_AREAS = [
  { code: "1", label: "Honolulu" },
  { code: "2", label: "Maui" },
  { code: "3", label: "Hawaii" },
  { code: "4", label: "Kauai" },
  { code: "0", label: "Statewide" },
] as const;

export interface MatchBreakdownRow {
  area: string;
  /** Rows in the bar. */
  total: number;
  /** Count per match value; "[NULL]" (unmatched) is split out below. */
  counts: Record<string, number>;
  /** Rows with no TMK at all (statewide bar only). */
  noTmk: number;
  /** cpr_match only: rows with a TMK but no unit match (parcel-level). */
  parcelOnly: number;
}

export interface MatchBreakdownResult {
  column: MatchColumn;
  rows: MatchBreakdownRow[];
  generatedAt: string | null;
}

/**
 * The tables with a records-by-year chart, keyed by freq_ table base name.
 * Every column here is counted by freq_ as a year ("2023") or a tax period
 * starting with one ("2023-2"). Snapshot tables with no year of their own
 * (properties, parcels, owners, ...) are deliberately absent.
 */
export const RECORDS_BY_YEAR_SOURCES = {
  assessments: { column: "tax_year", basis: "tax year" },
  sales: {
    column: "sale_date",
    basis: "sale date",
    // Coverage starts in the mid-1980s; earlier dates are a sparse tail and a
    // 1900-01-01 placeholder. They stay counted in the footnote.
    fromYear: 1980,
    note: "The latest year is partial.",
  },
  permits: {
    column: "permit_date",
    basis: "permit date",
    // Earlier dates are mostly a 1900s typo/placeholder tail.
    fromYear: 1950,
    note: "The latest year is partial.",
  },
  appeals: { column: "year", basis: "appeal year" },
  dedications: { column: "tax_year", basis: "tax year" },
  home_exemptions: {
    column: "tax_year",
    basis: "claim tax year",
    note: "Claim years run one year ahead of assessment years.",
  },
  current_tax_bills: { column: "tax_period", basis: "tax period year" },
  historical_tax_summary: { column: "year", basis: "tax year" },
  historical_tax_details: {
    column: "tax_period",
    basis: "tax period year",
    note: "A year combines all of its tax periods.",
  },
  historical_tax_payments: { column: "effective_date", basis: "payment date" },
  historical_tax_credits: {
    column: "period",
    basis: "tax period year",
    note: "A year combines all of its tax periods.",
  },
  residential_improvements: { column: "year_built", basis: "year built" },
  commercial_improvements: { column: "year_built", basis: "year built" },
  accessory_improvements: { column: "year_built", basis: "year built" },
  condominium_projects: {
    column: "final_date",
    basis: "final registration date",
  },
} as const satisfies Record<
  string,
  { column: string; basis: string; fromYear?: number; note?: string }
>;

export type RecordsByYearTable = keyof typeof RECORDS_BY_YEAR_SOURCES;

export function isRecordsByYearTable(
  table: string,
): table is RecordsByYearTable {
  return Object.hasOwn(RECORDS_BY_YEAR_SOURCES, table);
}

export type RecordsByYearResult = {
  /** One row per year, no gaps between the first and last. */
  rows: CoverageRow[];
  /** Statewide records with no usable year. */
  undated: number;
  /** Statewide records dated outside fromYear..toYear. */
  outOfRange: number;
  fromYear: number;
  toYear: number;
  generatedAt: string | null;
};
