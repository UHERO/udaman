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
