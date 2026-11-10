import { rawQuery } from "@/lib/mysql/hhdb";

import {
  BREAKDOWN_AREAS,
  RECORDS_BY_YEAR_SOURCES,
  type CoverageGranularity,
  type CoverageResult,
  type CoverageRow,
  type CoverageSeries,
  type MatchBreakdownResult,
  type MatchBreakdownRow,
  type MatchColumn,
  type RecordsByYearResult,
  type RecordsByYearTable,
} from "../types/hhdb-coverage";
import { monthFreqColumn } from "../utils/hhdb-freq-sql";
import { isMissingTableError } from "../utils/hhdb-missing-table";

export type {
  CoverageResult,
  CoverageRow,
  MatchBreakdownResult,
} from "../types/hhdb-coverage";

/**
 * Exploration-tab queries for the imputed-TMK tables, read from the table's
 * freq_ table — never the base table. The loaders rebuild freq_ right after
 * every load (crawlers/freq-refresh.ts), so these match what was loaded and
 * cost a few hundred rows instead of a 600k-row scan.
 *
 * freq_ counts each column per county (county_code 1–4, rows with a TMK only)
 * and statewide ('0', every row), so the rows with no TMK — the imputed-TMK
 * gap these tables have — are State minus the four counties.
 */

/**
 * The date columns each table's coverage can be counted on (the first is the
 * default), with the freq_ column_name and period of each.
 */
export const COVERAGE_SOURCES = {
  renthub_listings: [
    {
      date: "scraped_at",
      column: monthFreqColumn("scraped_at"),
      granularity: "month",
    },
    {
      date: "date_posted",
      column: monthFreqColumn("date_posted"),
      granularity: "month",
    },
  ],
  insurance_policies: [
    { date: "effective_date", column: "effective_date", granularity: "year" },
  ],
  insurance_claims: [
    { date: "date_of_loss", column: "date_of_loss", granularity: "year" },
  ],
} as const satisfies Record<
  string,
  readonly { date: string; column: string; granularity: CoverageGranularity }[]
>;

export type CoverageTable = keyof typeof COVERAGE_SOURCES;

export function isCoverageTable(table: string): table is CoverageTable {
  return Object.hasOwn(COVERAGE_SOURCES, table);
}

/** The match columns each table has a breakdown chart for. */
export const MATCH_COLUMNS: Record<CoverageTable, readonly MatchColumn[]> = {
  renthub_listings: ["tmk_match", "cpr_match"],
  insurance_policies: ["tmk_match"],
  insurance_claims: ["tmk_match"],
};

const COUNTY_CODE: Record<string, CoverageSeries> = {
  "1": "honolulu",
  "2": "maui",
  "3": "hawaii",
  "4": "kauai",
};

const PERIOD = { year: /^\d{4}$/, month: /^\d{4}-\d{2}$/ };

/** "2024-07" → "2024-08". */
function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

/**
 * Pure pivot of freq_ rows into one row per period, exported for tests.
 * Monthly series get a zero row for every month between the first and last,
 * so a delivery gap shows as a gap, not as a line drawn across it.
 */
export function pivotCoverage(
  freq: { county_code: string; column_value: string; frequency: number }[],
  granularity: CoverageGranularity = "year",
): CoverageRow[] {
  const byPeriod = new Map<string, CoverageRow>();
  const row = (period: string) => {
    let r = byPeriod.get(period);
    if (!r) {
      r = {
        period,
        total: 0,
        honolulu: 0,
        maui: 0,
        hawaii: 0,
        kauai: 0,
        no_tmk: 0,
      };
      byPeriod.set(period, r);
    }
    return r;
  };
  for (const f of freq) {
    // A NULL date has no period to plot.
    if (!PERIOD[granularity].test(f.column_value)) continue;
    const r = row(f.column_value);
    const n = Number(f.frequency);
    if (f.county_code === "0") r.total += n;
    else if (COUNTY_CODE[f.county_code]) r[COUNTY_CODE[f.county_code]] += n;
  }
  const periods = [...byPeriod.keys()].sort();
  if (granularity === "month" && periods.length)
    for (let m = periods[0]; m < periods[periods.length - 1]; m = nextMonth(m))
      row(m);
  const rows = [...byPeriod.values()].sort((a, b) =>
    a.period.localeCompare(b.period),
  );
  for (const r of rows)
    r.no_tmk = Math.max(0, r.total - r.honolulu - r.maui - r.hawaii - r.kauai);
  return rows;
}

/**
 * Pure pivot of freq_ rows for one match column into a bar per county and a
 * statewide bar, exported for tests. `noTmkStatewide` is the statewide count
 * of tmk_match = NULL (rows with no TMK at all).
 */
export function pivotMatchBreakdown(
  freq: { county_code: string; column_value: string; frequency: number }[],
  column: MatchColumn,
  noTmkStatewide: number,
): MatchBreakdownRow[] {
  return BREAKDOWN_AREAS.map(({ code, label }) => {
    const counts: Record<string, number> = {};
    let total = 0;
    let nulls = 0;
    for (const f of freq) {
      if (f.county_code !== code) continue;
      const n = Number(f.frequency);
      total += n;
      if (f.column_value === "[NULL]") nulls += n;
      else counts[f.column_value] = (counts[f.column_value] ?? 0) + n;
    }
    // County bars hold only rows with a TMK; the statewide bar's NULLs
    // include every row with no TMK.
    const noTmk = code === "0" ? noTmkStatewide : 0;
    return {
      area: label,
      total,
      counts,
      noTmk: column === "tmk_match" ? nulls : noTmk,
      parcelOnly: column === "cpr_match" ? Math.max(0, nulls - noTmk) : 0,
    };
  });
}

/** No plausible record predates this; zero-ish years are bad data. */
const EARLIEST_YEAR = 1800;

const emptyRow = (period: string): CoverageRow => ({
  period,
  total: 0,
  honolulu: 0,
  maui: 0,
  hawaii: 0,
  kauai: 0,
  no_tmk: 0,
});

/**
 * Pure pivot of freq_ rows into one row per year, exported for tests. Values
 * may be a year or a tax period ("2023-2"), which roll up to their year. Years
 * between the first and last with no records get a zero row, so the axis stays
 * a true time scale.
 */
export function pivotRecordsByYear(
  freq: { county_code: string; column_value: string; frequency: number }[],
  { fromYear, toYear }: { fromYear: number; toYear: number },
): Pick<RecordsByYearResult, "rows" | "undated" | "outOfRange"> {
  const byYear = new Map<number, CoverageRow>();
  let undated = 0;
  let outOfRange = 0;
  for (const f of freq) {
    const n = Number(f.frequency);
    const match = /^(\d{4})(?:-|$)/.exec(f.column_value);
    const year = match ? Number(match[1]) : null;
    const statewide = f.county_code === "0";
    if (year === null) {
      if (statewide) undated += n;
      continue;
    }
    if (year < fromYear || year > toYear) {
      if (statewide) outOfRange += n;
      continue;
    }
    let r = byYear.get(year);
    if (!r) {
      r = emptyRow(String(year));
      byYear.set(year, r);
    }
    if (statewide) r.total += n;
    else if (COUNTY_CODE[f.county_code]) r[COUNTY_CODE[f.county_code]] += n;
  }
  const years = [...byYear.keys()];
  const rows: CoverageRow[] = [];
  if (years.length) {
    const last = Math.max(...years);
    for (let y = Math.min(...years); y <= last; y++) {
      const r = byYear.get(y) ?? emptyRow(String(y));
      r.no_tmk = Math.max(
        0,
        r.total - r.honolulu - r.maui - r.hawaii - r.kauai,
      );
      rows.push(r);
    }
  }
  return { rows, undated, outOfRange };
}

type FreqRow = {
  county_code: string;
  column_value: string;
  frequency: number;
  generated_at: Date | string | null;
};

const stampOf = (rows: FreqRow[]) => {
  const s = rows[0]?.generated_at;
  return s instanceof Date ? s.toISOString() : s ? String(s) : null;
};

export default class HhdbCoverageCollection {
  static async byPeriod(
    table: CoverageTable,
    date?: string,
  ): Promise<CoverageResult> {
    const sources: readonly {
      date: string;
      column: string;
      granularity: CoverageGranularity;
    }[] = COVERAGE_SOURCES[table];
    const source = date ? sources.find((s) => s.date === date) : sources[0];
    if (!source) throw new Error(`No coverage of ${table} by ${date}`);
    const { column, granularity } = source;
    try {
      const freq = await rawQuery<FreqRow>(
        `SELECT county_code, column_value, frequency, generated_at
         FROM freq_${table} WHERE column_name = ?`,
        [column],
      );
      return {
        column,
        granularity,
        rows: pivotCoverage(freq, granularity),
        generatedAt: stampOf(freq),
      };
    } catch (err) {
      if (isMissingTableError(err))
        return { column, granularity, rows: [], generatedAt: null };
      throw err;
    }
  }

  static async recordsByYear(
    table: RecordsByYearTable,
  ): Promise<RecordsByYearResult> {
    const source: { column: string; fromYear?: number } =
      RECORDS_BY_YEAR_SOURCES[table];
    const range = {
      fromYear: source.fromYear ?? EARLIEST_YEAR,
      // Next year allows tax years billed ahead; later dates are typos.
      toYear: new Date().getFullYear() + 1,
    };
    try {
      // county_code leads the primary key: without it this scans the whole
      // freq_ table, which is tens of millions of rows for the tax history.
      const freq = await rawQuery<FreqRow>(
        `SELECT county_code, column_value, frequency, generated_at
         FROM freq_${table}
         WHERE county_code IN ('0', '1', '2', '3', '4') AND column_name = ?`,
        [source.column],
      );
      return {
        ...pivotRecordsByYear(freq, range),
        ...range,
        generatedAt: stampOf(freq),
      };
    } catch (err) {
      if (isMissingTableError(err))
        return {
          rows: [],
          undated: 0,
          outOfRange: 0,
          ...range,
          generatedAt: null,
        };
      throw err;
    }
  }

  static async matchBreakdown(
    table: CoverageTable,
    column: MatchColumn,
  ): Promise<MatchBreakdownResult> {
    try {
      // tmk_match rows come along for the statewide no-TMK count.
      const freq = await rawQuery<FreqRow & { column_name: string }>(
        `SELECT column_name, county_code, column_value, frequency, generated_at
         FROM freq_${table} WHERE column_name IN (?, 'tmk_match')`,
        [column],
      );
      const noTmk = freq
        .filter(
          (f) =>
            f.column_name === "tmk_match" &&
            f.county_code === "0" &&
            f.column_value === "[NULL]",
        )
        .reduce((n, f) => n + Number(f.frequency), 0);
      const own = freq.filter((f) => f.column_name === column);
      return {
        column,
        rows: own.length ? pivotMatchBreakdown(own, column, noTmk) : [],
        generatedAt: stampOf(own),
      };
    } catch (err) {
      if (isMissingTableError(err))
        return { column, rows: [], generatedAt: null };
      throw err;
    }
  }
}
