/**
 * Shapes shared by the coverage query (collections/hhdb-coverage-collection)
 * and the coverage chart. Pure: safe to import from client components.
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

export type CoverageRow = { year: string; total: number } & Record<
  CoverageSeries,
  number
>;

export interface CoverageResult {
  /** The date column the years come from. */
  column: string;
  rows: CoverageRow[];
  /** When freq_ was last rebuilt (ISO), or null when it is empty / missing. */
  generatedAt: string | null;
}
