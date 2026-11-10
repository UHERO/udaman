import { describe, expect, test } from "bun:test";

import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";

import { RECORDS_BY_YEAR_SOURCES } from "../types/hhdb-coverage";
import { extraFreqColumns } from "../utils/hhdb-freq-sql";
import {
  COVERAGE_SOURCES,
  isCoverageTable,
  MATCH_COLUMNS,
  pivotCoverage,
  pivotMatchBreakdown,
  pivotRecordsByYear,
} from "./hhdb-coverage-collection";

const f = (county_code: string, column_value: string, frequency: number) => ({
  county_code,
  column_value,
  frequency,
});

describe("pivotCoverage", () => {
  test("one row per year; no-TMK = State minus the four counties", () => {
    const rows = pivotCoverage([
      f("0", "2023", 100),
      f("1", "2023", 60),
      f("2", "2023", 25),
      f("4", "2023", 5),
      f("0", "2022", 10),
      f("3", "2022", 10),
      // NULL dates have no period to plot.
      f("0", "[NULL]", 7),
    ]);
    expect(rows).toEqual([
      {
        period: "2022",
        total: 10,
        honolulu: 0,
        maui: 0,
        hawaii: 10,
        kauai: 0,
        no_tmk: 0,
      },
      {
        period: "2023",
        total: 100,
        honolulu: 60,
        maui: 25,
        hawaii: 0,
        kauai: 5,
        no_tmk: 10,
      },
    ]);
  });

  test("monthly: missing months between the first and last are zero rows", () => {
    const rows = pivotCoverage(
      [
        f("0", "2024-11", 5),
        f("1", "2024-11", 5),
        f("0", "2025-02", 3),
        f("1", "2025-02", 1),
      ],
      "month",
    );
    expect(rows.map((r) => [r.period, r.total, r.no_tmk])).toEqual([
      ["2024-11", 5, 0],
      ["2024-12", 0, 0],
      ["2025-01", 0, 0],
      ["2025-02", 3, 2],
    ]);
  });

  test("rent listings are monthly, by scrape or post date; insurance stays yearly", () => {
    expect(COVERAGE_SOURCES.renthub_listings).toEqual([
      { date: "scraped_at", column: "scraped_at_month", granularity: "month" },
      {
        date: "date_posted",
        column: "date_posted_month",
        granularity: "month",
      },
    ]);
    expect(COVERAGE_SOURCES.insurance_claims[0].granularity).toBe("year");
  });

  test("every month column a chart reads is one freq_ counts", () => {
    for (const [table, sources] of Object.entries(COVERAGE_SOURCES))
      for (const s of sources)
        if (s.granularity === "month")
          expect(extraFreqColumns(table)).toContain(s.column);
  });

  test("only the three imputed-TMK tables have Exploration data", () => {
    expect(isCoverageTable("insurance_claims")).toBe(true);
    expect(isCoverageTable("properties")).toBe(false);
    expect(isCoverageTable("constructor")).toBe(false);
    expect(MATCH_COLUMNS.renthub_listings).toEqual(["tmk_match", "cpr_match"]);
  });
});

describe("pivotMatchBreakdown", () => {
  test("tmk_match: county bars + statewide, where NULL is 'no TMK'", () => {
    const rows = pivotMatchBreakdown(
      [
        f("1", "within_addr", 80),
        f("1", "within", 20),
        f("0", "within_addr", 80),
        f("0", "within", 20),
        f("0", "[NULL]", 5),
      ],
      "tmk_match",
      5,
    );
    expect(rows.map((r) => r.area)).toEqual([
      "Honolulu",
      "Maui",
      "Hawaii",
      "Kauai",
      "Statewide",
    ]);
    expect(rows[0]).toEqual({
      area: "Honolulu",
      total: 100,
      counts: { within_addr: 80, within: 20 },
      noTmk: 0,
      parcelOnly: 0,
    });
    expect(rows[4]).toMatchObject({ total: 105, noTmk: 5 });
  });

  test("cpr_match: statewide NULLs split into parcel-only and no-TMK", () => {
    const rows = pivotMatchBreakdown(
      [
        f("1", "unit", 30),
        f("1", "[NULL]", 70),
        f("0", "unit", 30),
        f("0", "[NULL]", 75),
      ],
      "cpr_match",
      5,
    );
    expect(rows[0]).toMatchObject({
      counts: { unit: 30 },
      parcelOnly: 70,
      noTmk: 0,
    });
    expect(rows[4]).toMatchObject({
      counts: { unit: 30 },
      parcelOnly: 70,
      noTmk: 5,
      total: 105,
    });
  });
});

describe("pivotRecordsByYear", () => {
  const range = { fromYear: 1980, toYear: 2027 };

  test("tax periods roll up to their year; statewide comes from county 0", () => {
    const { rows } = pivotRecordsByYear(
      [
        f("0", "2023-1", 10),
        f("0", "2023-2", 12),
        f("1", "2023-1", 7),
        f("1", "2023-2", 8),
        f("3", "2023-2", 4),
      ],
      range,
    );
    expect(rows).toEqual([
      {
        period: "2023",
        total: 22,
        honolulu: 15,
        maui: 0,
        hawaii: 4,
        kauai: 0,
        no_tmk: 3,
      },
    ]);
  });

  test("gaps between years become zero rows", () => {
    const { rows } = pivotRecordsByYear(
      [f("0", "2020", 1), f("0", "2023", 2)],
      range,
    );
    expect(rows.map((r) => [r.period, r.total])).toEqual([
      ["2020", 1],
      ["2021", 0],
      ["2022", 0],
      ["2023", 2],
    ]);
  });

  test("NULL and out-of-range years are counted once, statewide only", () => {
    const result = pivotRecordsByYear(
      [
        f("0", "[NULL]", 5),
        f("1", "[NULL]", 5),
        f("0", "1900", 7),
        f("1", "1900", 7),
        f("0", "2120", 1),
        f("2", "2120", 1),
        f("0", "2000", 3),
      ],
      range,
    );
    expect(result.undated).toBe(5);
    expect(result.outOfRange).toBe(8);
    expect(result.rows.map((r) => r.period)).toEqual(["2000"]);
  });

  test("no rows means no years", () => {
    expect(pivotRecordsByYear([], range).rows).toEqual([]);
  });

  test("every source is a table with its Exploration tab enabled", () => {
    const enabled = Object.values(HHDB_TABLE_CONFIG)
      .filter((c) => c.exploration)
      .map((c) => c.fieldsTable);
    for (const table of Object.keys(RECORDS_BY_YEAR_SOURCES))
      expect(enabled).toContain(table);
  });
});
