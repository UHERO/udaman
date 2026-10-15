import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";

import type { IRCell } from "../ir";
import { readLegacyWorkbook } from "./legacy";

type Row = (string | number | null)[];

function workbook(
  sheets: Record<string, Row[]>,
  merges: Record<string, string[]> = {},
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const sh = XLSX.utils.aoa_to_sheet(rows);
    if (merges[name])
      sh["!merges"] = merges[name].map((r) => XLSX.utils.decode_range(r));
    XLSX.utils.book_append_sheet(wb, sh, name);
  }
  return wb;
}

function read(
  sheets: Record<string, Row[]>,
  merges?: Record<string, string[]>,
) {
  return readLegacyWorkbook(workbook(sheets, merges), 2013, 1);
}

const find = (cells: IRCell[], addr: string) =>
  cells.find((c) => c.cellAddr === addr);

describe("split date column (01.06-like)", () => {
  const res = read({
    Titles: [
      ["Table Number", "Table Name"],
      ["01.06", "Resident Population"],
    ],
    "1.06": [
      ["Table 1.06-- RESIDENT POPULATION, BY COUNTIES:  1980 TO 1982"],
      [],
      ["            [Based on place of usual residence.  Includes armed "],
      ["        forces stationed in Hawaii]"],
      [],
      [
        "Date",
        null,
        "State             total 1/",
        "Maui                 County 2/",
      ],
      [],
      ["1980:", "April 1", 964691, 70991],
      [null, "July 1 ", 968500, 71600],
      ["1981:", "July 1", 978195, "(NA)"],
      [],
      [" ", "July 1", null, null],
      ["1982:", "July 1", 993780, 77103],
      [],
      ["     1/  Estimates after April 1, 2000 are revised and may differ "],
      ["somewhat from earlier figures."],
      ["2/  Including Kalawao County."],
      ["     Source:  U.S. Census Bureau, Population Estimates "],
      [
        "<http://eire.census.gov/popest/data/counties/> accessed April 17, 2003.",
      ],
    ],
  });
  const t = res.tables[0];

  it("reads the table number from the title, not the sheet name", () => {
    expect(res.tables).toHaveLength(1);
    expect(t.tableNum).toBe("01.06");
    expect(t.sheet).toBe("1.06");
    expect(t.title).toBe("RESIDENT POPULATION, BY COUNTIES");
    expect(t.titlePeriod).toBe("1980 TO 1982");
    expect(t.headnote).toMatch(/^Based on place .* stationed in Hawaii$/);
  });

  it("classifies long and joins the year and point columns", () => {
    expect(t.layout).toBe("long");
    expect(t.panels[0].headers).toEqual({
      2: ["State total"],
      3: ["Maui County"],
    });
    const c = find(res.cells, "1.06!C9")!;
    expect(c.period).toMatchObject({
      year: 1980,
      basis: "point",
      point: "July 1",
    });
    expect(c.rowPath).toEqual([]);
    expect(c.colPath).toEqual(["State total"]);
    expect(c.markers).toEqual(["1"]);
    expect(find(res.cells, "1.06!D9")!.markers).toEqual(["2"]);
  });

  it("keeps July 1 over the April 1 census base for the same year", () => {
    expect(find(res.cells, "1.06!C8")).toBeUndefined();
    expect(t.warnings.join(" ")).toMatch(/duplicate-period/);
  });

  it("skips suppression codes and emits every other number", () => {
    expect(find(res.cells, "1.06!D10")).toBeUndefined();
    expect(res.cells.map((c) => c.cellAddr).sort()).toEqual(
      ["1.06!C9", "1.06!D9", "1.06!C10", "1.06!C13", "1.06!D13"].sort(),
    );
  });

  it("collects footnotes and source", () => {
    expect(t.footnotes).toEqual({
      "1": "Estimates after April 1, 2000 are revised and may differ somewhat from earlier figures.",
      "2": "Including Kalawao County.",
    });
    expect(t.source).toMatch(/^U\.S\. Census Bureau, Population Estimates/);
    expect(t.sourceUrl).toBe("http://eire.census.gov/popest/data/counties/");
  });
});

describe("header bands, year blocks, wrapped labels (12.05-like)", () => {
  const sheet: Row[] = [
    ["Table 12.05-- CIVILIAN LABOR FORCE, AND UNEMPLOYMENT RATE, "],
    ["TOTAL AND FEMALE, BY RACE AND HISPANIC ORIGIN:  2011 AND 2012"],
    [],
    ["[Totals may not add due to rounding]"],
    [],
    [null, "Civilian labor force", null, "Unemployed (percent)", null],
    ["Race or origin 1/", "Both sexes", "Female", "Both sexes", "Female"],
    [],
    [2011],
    [],
    ["All races", 660700, 318700, 6.7, 6],
    [],
    ["One race"],
    ["     White", 169550, 77600, 6.3, 6.1],
    ["     American Indian and Alaska"],
    ["        Native", 1650, 800, 15.9, 19.1],
    ["     Asian", 291700, 146600, 4.4, 3.6],
    ["Two or more races", 125750, 60450, 9.3, 8.7],
    [],
    ["2012:"],
    [],
    ["All races", 651600, 311550, 5.8, 4.8],
    ["One race"],
    ["     White", 169250, 75350, 6.4, 5.6],
    [],
    ["1/  Based on census definitions."],
    ["     Source:  Hawaii State Department of Labor & Industrial Relations."],
  ];
  const res = read({ "12.05": sheet }, { "12.05": ["B6:C6"] });
  const t = res.tables[0];

  it("fills bands over their leaf columns, merged or not", () => {
    expect(t.panels[0].headers).toEqual({
      1: ["Civilian labor force", "Both sexes"],
      2: ["Civilian labor force", "Female"],
      3: ["Unemployed (percent)", "Both sexes"],
      4: ["Unemployed (percent)", "Female"],
    });
  });

  it("dates rows by their year block without splitting the series", () => {
    expect(t.layout).toBe("long");
    expect(t.panels).toHaveLength(1);
    const w11 = find(res.cells, "12.05!C14")!;
    const w12 = find(res.cells, "12.05!C24")!;
    expect(w11.period.year).toBe(2011);
    expect(w12.period.year).toBe(2012);
    expect(w11.panel).toBe(w12.panel);
    expect(w11.rowPath).toEqual(w12.rowPath);
    expect(w11.colPath).toEqual(["Civilian labor force", "Female"]);
  });

  it("builds row paths from indentation and joins wrapped labels", () => {
    expect(find(res.cells, "12.05!B14")!.rowPath).toEqual([
      "One race",
      "White",
    ]);
    expect(find(res.cells, "12.05!B16")!.rowPath).toEqual([
      "One race",
      "American Indian and Alaska Native",
    ]);
    expect(find(res.cells, "12.05!B17")!.rowPath).toEqual([
      "One race",
      "Asian",
    ]);
    expect(find(res.cells, "12.05!B18")!.rowPath).toEqual([
      "Two or more races",
    ]);
  });
});

describe("wide tables", () => {
  const res = read({
    "01.11": [
      ["Table 1.11-- RESIDENT POPULATION OF COUNTIES AND JUDICIAL"],
      ["  DISTRICTS:  1990 TO 2010"],
      [],
      ["District", 1990, 2000, 2010, "Change, 2000 - 2010"],
      [],
      ["State total", 1108229, 1211537, 1360301, 148764],
      [],
      ["Hawaii County", 120317, 148677, 185079, 36402],
      ["  Puna", 20781, 31335, 45326, 13991],
      ["  South Hilo", 44639, 47386, 50927, 3541],
      ["Kahoolawe", "-", "-", "-", "-"],
      [],
      ["Source:  U.S. Census Bureau."],
    ],
    "01.27": [
      ["Table 1.27-- RESIDENT POPULATION, BY AGE AND SEX:  2020 AND 2024"],
      [],
      [null, "April 1, 2020 1/", null, "July 1, 2024", null],
      ["Age group", "Both sexes", "Male", "Both sexes", "Male"],
      [],
      ["Total", 1455252, 733605, 1446146, 724435],
      ["Under 5 years", 85858, 44345, 76624, 39355],
      [],
      ["Under 18 years", 307784, 158705, 293349, 150916],
      ["Under 5 years", 85858, 44345, 76624, 39355],
      ["In percent"],
      ["Under 18 years", 21.2, 21.6, 20.3, 20.8],
      [],
      ["Source:  U.S. Census Bureau."],
    ],
  });

  it("takes periods from year headers and skips interval columns", () => {
    const t = res.tables.find((x) => x.tableNum === "01.11")!;
    expect(t.layout).toBe("wide");
    const puna = res.cells.filter((c) => c.rowPath.at(-1) === "Puna");
    expect(puna.map((c) => [c.period.year, c.value])).toEqual([
      [1990, 20781],
      [2000, 31335],
      [2010, 45326],
    ]);
    expect(puna[0].rowPath).toEqual(["Hawaii County", "Puna"]);
    expect(puna[0].colPath).toEqual([]);
    expect(t.warnings.join(" ")).toMatch(/interval/);
  });

  it("splits the period off a band and keeps the leaf as the column", () => {
    const t = res.tables.find((x) => x.tableNum === "01.27")!;
    expect(t.layout).toBe("wide");
    const c = find(res.cells, "01.27!B6")!;
    expect(c.period).toMatchObject({ year: 2020, basis: "point" });
    expect(c.colPath).toEqual(["Both sexes"]);
    expect(c.markers).toEqual(["1"]);
    expect(find(res.cells, "01.27!D6")!.period.year).toBe(2024);
  });

  it("suffixes repeated row labels and scopes same-indent headings", () => {
    const rows = res.cells
      .filter((c) => c.tableNum === "01.27" && c.cellAddr.match(/!B\d+$/))
      .map((c) => c.rowPath);
    expect(rows).toEqual([
      ["Total"],
      ["Under 5 years"],
      ["Under 18 years"],
      ["Under 5 years (2)"],
      ["In percent", "Under 18 years"],
    ]);
  });
});

describe("measures over a wide table (13.11, 13.14)", () => {
  const res = read({
    "13.11": [
      ["Table 13.11-- PERSONAL INCOME, TOTAL AND PER CAPITA:  2018 TO 2019"],
      [],
      ["State", 2018, 2019],
      [],
      ["Real personal income (millions of dollars) 1/"],
      [],
      ["United States", 17163074, 17727562],
      [],
      ["Alabama", 231109.9, 235847.2],
      [],
      ["Table 13.11-- PERSONAL INCOME, TOTAL AND PER CAPITA:"],
      ["  2018 TO 2019 -- Con."],
      [],
      ["State", 2018, 2019],
      [],
      ["Hawaii", 85000.5, 86000.1],
      [],
      ["Real per capita personal income (dollars) 1/"],
      [],
      ["United States", 52242, 53683],
      [],
      ["Alabama", 46435, 47134],
      ["Hawaii", 58000, 59000],
      [],
      ["1/  Chained 2017 dollars."],
    ],
    "13.14": [
      ["Table 13.14-- THE NEW ECONOMY INDEX, RANK AND SCORE:  2008 TO 2010"],
      [],
      [null, "Rank ", null, "Score"],
      ["State", 2008, 2010, 2008, 2010],
      [],
      ["Alabama", 47, 47, 37.4, 43.5],
      ["Hawaii", 25, 26, 55.1, 56.2],
      [],
      ["Source:  ITIF."],
    ],
  });

  it("keeps a section heading as colPath across blank rows and a continued page", () => {
    const hi = res.cells.filter(
      (c) => c.tableNum === "13.11" && c.rowPath[0] === "Hawaii",
    );
    expect(hi.map((c) => [c.colPath, c.period.year, c.value])).toEqual([
      [["Real personal income (millions of dollars)"], 2018, 85000.5],
      [["Real personal income (millions of dollars)"], 2019, 86000.1],
      [["Real per capita personal income (dollars)"], 2018, 58000],
      [["Real per capita personal income (dollars)"], 2019, 59000],
    ]);
    expect(hi[0].rowPath).toEqual(["Hawaii"]);
    expect(hi[0].markers).toContain("1");
  });

  it("keeps non-repeating sections (islands over sites) in rowPath", () => {
    const r = read({
      "18.18": [
        ["Table 18.18-- TOTAL 24-HOUR TRAFFIC VOLUME:  2022 TO 2023"],
        [],
        ["Island and site", 2022, 2023],
        [],
        ["Oahu"],
        [],
        ["H-1 at Kapolei", 88500, 88800],
        ["H-2 at Mililani", 70100, 70500],
        [],
        ["Maui"],
        [],
        ["Hana Hwy at Paia", 21000, 21500],
        [],
        ["Source:  HDOT."],
      ],
    });
    const c = r.cells.find((x) => x.cellAddr === "18.18!B12")!;
    expect(c.rowPath).toEqual(["Maui", "Hana Hwy at Paia"]);
    expect(c.colPath).toEqual([]);
  });

  it("starts a panel at a lone caption that replaces the top band (13.19)", () => {
    const r = read({
      "13.19": [
        ["Table 13.19-- MEDIAN MONEY INCOME OF HOUSEHOLDS:  2019 TO 2020"],
        [],
        [null, "Median income in current dollars"],
        [null, "Hawaii", null, "United States", null],
        ["Year", "Amount", "Percent change", "Amount", "Percent change"],
        [],
        [2019, 83102, 2.1, 68703, 8.7],
        [2020, 80729, -2.9, 67521, -1.7],
        [],
        [null, "Median income in constant (2020) dollars"],
        [2019, 84000, 1.5, 69560, 6.8],
        [2020, 80729, -3.9, 67521, -2.9],
        [],
        ["Source:  Census."],
      ],
    });
    const t = r.tables[0];
    expect(t.panels.map((p) => p.label)).toEqual([
      "",
      "Median income in constant (2020) dollars",
    ]);
    const c = r.cells.find((x) => x.cellAddr === "13.19!B11")!;
    expect(c.panel).toBe(1);
    expect(c.colPath).toEqual([
      "Median income in constant (2020) dollars",
      "Hawaii",
      "Amount",
    ]);
    expect(t.warnings.join(" ")).not.toMatch(/duplicate/);
  });

  it("keeps a band over year leaves as the column", () => {
    const hi = res.cells.filter(
      (c) => c.tableNum === "13.14" && c.rowPath[0] === "Hawaii",
    );
    expect(hi.map((c) => [c.colPath, c.period.year])).toEqual([
      [["Rank"], 2008],
      [["Rank"], 2010],
      [["Score"], 2008],
      [["Score"], 2010],
    ]);
  });
});

describe("panels, continuation pages, text tables, narrative", () => {
  const res = read({
    Narrative: [["Section 2 covers vital statistics."], ["Births and deaths."]],
    "02.02": [
      ["Table 2.02-- BIRTHS AND DEATHS:  2019 TO 2021"],
      [],
      ["Subject and year", "All groups", "Armed forces"],
      [],
      ["Live births 2/"],
      [2019, 16834, "(2/)"],
      [2020, 15803, "(2/)"],
      [],
      ["   Continued on next page."],
      ["Table 2.02-- BIRTHS AND DEATHS:  2019 TO 2021-- Con."],
      [],
      ["Subject and year", "All groups", "Armed forces"],
      [],
      [2021, 15627, "(2/)"],
      [],
      ["Deaths"],
      [2019, 11753, 34],
      [2020, 12102, 52],
      [],
      ["2/  Not collected."],
      ["Source:  Department of Health."],
    ],
    "05.21": [
      ["Table 5.21-- MAJOR DAMS:  2020"],
      [],
      ["Dam", "Island", "Owner", "Height (feet)"],
      [],
      ["Wahiawa", "Oahu", "Dole", 85],
      ["Nuuanu", "Oahu", "BWS", 77],
      ["Kaloko", "Kauai", "Private", 40],
      [],
      ["Source:  DLNR."],
    ],
  });

  it("starts long-table panels at label rows, ignoring continued headers", () => {
    const t = res.tables.find((x) => x.tableNum === "02.02")!;
    expect(t.layout).toBe("long");
    expect(t.panels.map((p) => p.label)).toEqual(["Live births", "Deaths"]);
    const births = res.cells.filter((c) => c.panel === 0);
    expect(births.map((c) => c.period.year)).toEqual([2019, 2020, 2021]);
    expect(births[0].markers).toEqual(["2"]);
    expect(res.cells.filter((c) => c.panel === 1)).toHaveLength(4);
    expect(t.footnotes["2"]).toBe("Not collected.");
  });

  it("classifies name lists as text and emits nothing", () => {
    const t = res.tables.find((x) => x.tableNum === "05.21")!;
    expect(t.layout).toBe("text");
    expect(res.cells.some((c) => c.tableNum === "05.21")).toBe(false);
  });

  it("captures the narrative sheet", () => {
    expect(res.narrative).toBe(
      "Section 2 covers vital statistics.\nBirths and deaths.",
    );
  });
});
