import { describe, expect, test } from "bun:test";

import { isCoverageTable, pivotCoverage } from "./hhdb-coverage-collection";

describe("pivotCoverage", () => {
  test("one row per year; no-TMK = State minus the four counties", () => {
    const rows = pivotCoverage([
      { county_code: "0", column_value: "2023", frequency: 100 },
      { county_code: "1", column_value: "2023", frequency: 60 },
      { county_code: "2", column_value: "2023", frequency: 25 },
      { county_code: "4", column_value: "2023", frequency: 5 },
      { county_code: "0", column_value: "2022", frequency: 10 },
      { county_code: "3", column_value: "2022", frequency: 10 },
      // NULL dates have no year to plot.
      { county_code: "0", column_value: "[NULL]", frequency: 7 },
    ]);
    expect(rows).toEqual([
      {
        year: "2022",
        total: 10,
        honolulu: 0,
        maui: 0,
        hawaii: 10,
        kauai: 0,
        no_tmk: 0,
      },
      {
        year: "2023",
        total: 100,
        honolulu: 60,
        maui: 25,
        hawaii: 0,
        kauai: 5,
        no_tmk: 10,
      },
    ]);
  });

  test("only the three imputed-TMK tables have a coverage chart", () => {
    expect(isCoverageTable("insurance_claims")).toBe(true);
    expect(isCoverageTable("properties")).toBe(false);
    expect(isCoverageTable("constructor")).toBe(false);
  });
});
