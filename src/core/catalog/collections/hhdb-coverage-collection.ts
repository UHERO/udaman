import { rawQuery } from "@/lib/mysql/hhdb";

import type {
  CoverageResult,
  CoverageRow,
  CoverageSeries,
} from "../types/hhdb-coverage";
import { isMissingTableError } from "../utils/hhdb-missing-table";

export type { CoverageResult, CoverageRow } from "../types/hhdb-coverage";

/**
 * Records per year by county for the Exploration tab's coverage chart, read
 * from the table's freq_ table — never the base table. The loaders rebuild
 * freq_ right after every load (crawlers/freq-refresh.ts), so this matches
 * what was loaded, and costs a few hundred rows instead of a 600k-row scan.
 *
 * freq_ counts a date column by year, per county (county_code 1–4, rows with
 * a TMK only) and statewide ('0', every row), so the rows with no TMK — the
 * imputed-TMK gap these tables have — are State minus the four counties.
 */

/** The date column each table's coverage is counted on. */
export const COVERAGE_SOURCES = {
  renthub_listings: "scraped_at",
  insurance_policies: "effective_date",
  insurance_claims: "date_of_loss",
} as const;

export type CoverageTable = keyof typeof COVERAGE_SOURCES;

export function isCoverageTable(table: string): table is CoverageTable {
  return Object.hasOwn(COVERAGE_SOURCES, table);
}

const COUNTY_CODE: Record<string, CoverageSeries> = {
  "1": "honolulu",
  "2": "maui",
  "3": "hawaii",
  "4": "kauai",
};

/** Pure pivot of freq_ rows into one row per year, exported for tests. */
export function pivotCoverage(
  freq: { county_code: string; column_value: string; frequency: number }[],
): CoverageRow[] {
  const byYear = new Map<string, CoverageRow>();
  const row = (year: string) => {
    let r = byYear.get(year);
    if (!r) {
      r = {
        year,
        total: 0,
        honolulu: 0,
        maui: 0,
        hawaii: 0,
        kauai: 0,
        no_tmk: 0,
      };
      byYear.set(year, r);
    }
    return r;
  };
  for (const f of freq) {
    // A NULL date has no year to plot.
    if (!/^\d{4}$/.test(f.column_value)) continue;
    const r = row(f.column_value);
    const n = Number(f.frequency);
    if (f.county_code === "0") r.total += n;
    else if (COUNTY_CODE[f.county_code]) r[COUNTY_CODE[f.county_code]] += n;
  }
  const rows = [...byYear.values()].sort((a, b) =>
    a.year.localeCompare(b.year),
  );
  for (const r of rows)
    r.no_tmk = Math.max(0, r.total - r.honolulu - r.maui - r.hawaii - r.kauai);
  return rows;
}

export default class HhdbCoverageCollection {
  static async byYear(table: CoverageTable): Promise<CoverageResult> {
    const column = COVERAGE_SOURCES[table];
    try {
      const freq = await rawQuery<{
        county_code: string;
        column_value: string;
        frequency: number;
        generated_at: Date | string | null;
      }>(
        `SELECT county_code, column_value, frequency, generated_at
         FROM freq_${table} WHERE column_name = ?`,
        [column],
      );
      const stamp = freq[0]?.generated_at;
      return {
        column,
        rows: pivotCoverage(freq),
        generatedAt:
          stamp instanceof Date
            ? stamp.toISOString()
            : stamp
              ? String(stamp)
              : null,
      };
    } catch (err) {
      if (isMissingTableError(err))
        return { column, rows: [], generatedAt: null };
      throw err;
    }
  }
}
