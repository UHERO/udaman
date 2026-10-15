import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import { afterAll, describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";

import type { IRCell } from "../ir";
import {
  readAccessibleEdition,
  readAccessibleSection,
  readAccessibleWorkbook,
  sectionFileName,
} from "./accessible";

type Row = (string | number | null)[];

/** Sheet from rows, with optional number formats by A1 address. */
function sheet(rows: Row[], fmts: Record<string, string> = {}): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  for (const [addr, z] of Object.entries(fmts)) ws[addr].z = z;
  return ws;
}

function book(sheets: Record<string, XLSX.WorkSheet>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, ws] of Object.entries(sheets))
    XLSX.utils.book_append_sheet(wb, ws, name);
  return wb;
}

function readOne(name: string, ws: XLSX.WorkSheet) {
  const res = readAccessibleWorkbook(book({ [name]: ws }), 2025, 1);
  return { table: res.tables[0], cells: res.cells };
}

function at(cells: IRCell[], addr: string): IRCell | undefined {
  return cells.find((c) => c.cellAddr.endsWith(`!${addr}`));
}

const SOURCE: Row[] = [
  ["Source:  U.S. Census Bureau, (CO-"],
  ["EST2024) <https://www.census.gov/popest> accessed April 24, 2026."],
];

// 01.06: long, geography columns, April 1 / July 1 rows for the same year.
const T0106: Row[] = [
  ["Table 1.06-- RESIDENT POPULATION, BY COUNTY:  2010 TO 2025"],
  ["[Based on place of usual residence, "],
  ['excludes visitors present.  Revised from previous "Data Book"]'],
  ["Date [a]", "State total", "Honolulu", "Maui County [b]"],
  ["2010: April 1", 1360304, 953203, 154930],
  ["2010: July 1", 1365117, 957547, 155033],
  ["2011: July 1", 1385141, 973655, 156654],
  [null],
  ["[a]  April 1 figures are the estimates base, derived from the "],
  ["Decennial Census."],
  ["[b]  Maui County includes Kalawao County."],
  ...SOURCE,
];

describe("long tables", () => {
  const { table, cells } = readOne("01.06", sheet(T0106));

  it("reads title, headnote, footnotes and source", () => {
    expect(table.tableNum).toBe("01.06");
    expect(table.title).toBe("RESIDENT POPULATION, BY COUNTY");
    expect(table.titlePeriod).toBe("2010 TO 2025");
    expect(table.headnote).toBe(
      '[Based on place of usual residence, excludes visitors present. Revised from previous "Data Book"]',
    );
    expect(table.footnotes).toEqual({
      a: "April 1 figures are the estimates base, derived from the Decennial Census.",
      b: "Maui County includes Kalawao County.",
    });
    // Mid-word wrap "(CO-" / "EST2024)" joins without a space.
    expect(table.source).toContain("(CO-EST2024)");
    expect(table.sourceUrl).toBe("https://www.census.gov/popest");
  });

  it("emits one cell per numeric value with period from col A", () => {
    expect(table.layout).toBe("long");
    expect(at(cells, "B6")).toMatchObject({
      rowPath: [],
      colPath: ["State total"],
      value: 1365117,
      period: { date: "2010-01-01", basis: "point", point: "July 1" },
    });
    expect(at(cells, "D7")).toMatchObject({
      colPath: ["Maui County"],
      markers: ["b"],
      value: 156654,
    });
  });

  it("keeps July 1 over April 1 for the same year", () => {
    expect(at(cells, "B5")).toBeUndefined();
    expect(cells).toHaveLength(6);
    expect(table.warnings.join()).toContain("duplicate-period");
  });
});

describe("stacked panels (02.02)", () => {
  const { table, cells } = readOne(
    "02.02",
    sheet(
      [
        ["Table 2.02-- BIRTHS AND DEATHS, BY MILITARY STATUS:  2020 TO 2021"],
        ["Live births by year [a]", "All groups", "Armed forces"],
        [2020, 15803, "[a]"],
        [2021, 15627, "[a]"],
        ["Deaths by year", "All groups", "Armed forces"],
        [2020, 12090, 52],
        [2021, 12903, 35],
        ["[a]  Not collected."],
        ["[c]  Revised."],
        ...SOURCE,
      ],
      { B6: '#,##0\\ "[c]"' },
    ),
  );

  it("splits panels at a repeated header row", () => {
    expect(table.layout).toBe("long");
    expect(table.panels.map((p) => p.label)).toEqual([
      "Live births by year",
      "Deaths by year",
    ]);
    expect(at(cells, "B6")).toMatchObject({
      panel: 1,
      colPath: ["All groups"],
      value: 12090,
    });
  });

  it("treats a bare marker as no data and reads markers from formats", () => {
    expect(at(cells, "C3")).toBeUndefined();
    expect(at(cells, "B6")!.markers).toEqual(["c"]);
    expect(at(cells, "B6")!.numFmt).toBe('#,##0\\ "[c]"');
    expect(cells).toHaveLength(6);
  });
});

describe("wide tables", () => {
  it("builds rowPath from the hierarchy column and splits composite headers (01.27)", () => {
    const { table, cells } = readOne(
      "01.27",
      sheet([
        ["Table 1.27-- RESIDENT POPULATION, BY AGE AND SEX:  2020 AND 2025"],
        [
          "Age group",
          "Age group hierarchy",
          "April 1, 2020, Both sexes [a]",
          "July 1, 2025, Female",
        ],
        ["Total", "Level 1", 1455267, 720429],
        ["Under 5 years", "Level 2", 82861, 35885],
        ["Under 1 year", "Level 3", 15000, 7000],
        ["5 to 9 years", "Level 2", 84404, 38564],
        ...SOURCE,
      ]),
    );
    expect(table.layout).toBe("wide");
    expect(table.panels[0].headers).toEqual({
      0: ["Age group"],
      2: ["April 1, 2020, Both sexes"],
      3: ["July 1, 2025, Female"],
    });
    expect(at(cells, "C5")).toMatchObject({
      rowPath: ["Total", "Under 5 years", "Under 1 year"],
      colPath: ["Both sexes"],
      period: { date: "2020-01-01", point: "April 1" },
    });
    expect(at(cells, "D6")).toMatchObject({
      rowPath: ["Total", "5 to 9 years"],
      colPath: ["Female"],
      period: { date: "2025-01-01" },
    });
    expect(at(cells, "B3")).toBeUndefined(); // "Level 1" is not data
  });

  it("strips the year from measure headers (13.11)", () => {
    const { table, cells } = readOne(
      "13.11",
      sheet([
        ["Table 13.11-- PERSONAL INCOME, BY STATE:  2018 TO 2019"],
        [
          "State",
          "Real SPI 2018",
          "Real SPI 2019",
          "Real SPI per capita  2018",
          "Real SPI per capita 2019",
        ],
        ["United States", 17163074, 17727562, 52242, 53683],
        ["Hawaii", 80000, 81000, 55000, 56000],
        ...SOURCE,
      ]),
    );
    expect(table.layout).toBe("wide");
    expect(at(cells, "D4")).toMatchObject({
      rowPath: ["Hawaii"],
      colPath: ["Real SPI per capita"],
      period: { date: "2018-01-01", basis: "calendar" },
      value: 55000,
    });
    expect(new Set(cells.map((c) => c.colPath[0]))).toEqual(
      new Set(["Real SPI", "Real SPI per capita"]),
    );
  });

  it("dates period-less columns by the title, or skips them with a warning", () => {
    const rows = (title: string): Row[] => [
      [title],
      ["Island", "2010", "2020", "Percent change"],
      ["Oahu", 953207, 1016508, 0.066],
      ...SOURCE,
    ];
    const ranged = readOne(
      "01.35",
      sheet(rows("Table 1.35-- X:  2010 TO 2020")),
    );
    expect(ranged.cells).toHaveLength(2);
    expect(ranged.table.warnings.join()).toContain("no-period");

    // Interval headers ("Change between 2010 and 2020") count as period-like
    // for classification but are skipped.
    const change = readOne(
      "01.31",
      sheet([
        ["Table 1.31-- POPULATION BY MAJOR RACE:  2010 AND 2020"],
        ["Race", "2010 Census", "2020 Census", "Change between 2010 and 2020"],
        ["White", 336599, 333261, -3338],
        ...SOURCE,
      ]),
    );
    expect(change.table.layout).toBe("wide");
    expect(change.cells.map((c) => c.period.year)).toEqual([2010, 2020]);
    expect(change.cells[0].colPath).toEqual(["Census"]);
    expect(change.table.warnings.join()).toContain("interval");
  });
});

describe("snapshot tables (01.29)", () => {
  const { table, cells } = readOne(
    "01.29",
    sheet(
      [
        ["Table 1.29-- RESIDENT POPULATION BY AGE GROUP, BY COUNTY:  2025"],
        ["[As of July 1]"],
        ["Age group", "State total", "Maui County [a]"],
        ["Total", 1432820, 160674],
        ["Under 18 years", 281717, 32980],
        ["Under 18 years", 0.1966, 0.2053],
        ["[a]  Including Kalawao."],
        ...SOURCE,
      ],
      { B6: "0.0%", C6: "0.0%" },
    ),
  );

  it("takes the period from the title; rows and columns are dims", () => {
    expect(table.layout).toBe("snapshot");
    expect(at(cells, "C4")).toMatchObject({
      rowPath: ["Total"],
      colPath: ["Maui County"],
      markers: ["a"],
      period: { date: "2025-01-01", basis: "calendar" },
    });
  });

  it("scales percent fractions to percent units, keeps the format, and disambiguates repeated rows", () => {
    expect(at(cells, "B6")).toMatchObject({
      rowPath: ["Under 18 years (2)"],
      value: 19.66,
      numFmt: "0.0%",
    });
    expect(table.warnings.join()).toContain("repeated-row-label");
  });
});

describe("other layouts and values", () => {
  it("reads a period from a 'Year' column beside a text dimension (07.02, 13.12)", () => {
    const { table, cells } = readOne(
      "13.12",
      sheet([
        ["Table 13.12-- PERSONAL INCOME, BY COUNTY:  1979 TO 1980"],
        ["Category", "Year", "State total", "Honolulu"],
        ["Total ($1,000)", 1979, 10043646, 8373566],
        ["Total ($1,000)", 1980, 11488240, 9425648],
        ["Per capita (dollars)", 1979, 10500, 11000],
        ...SOURCE,
      ]),
    );
    expect(table.layout).toBe("long");
    expect(at(cells, "D4")).toMatchObject({
      rowPath: ["Total ($1,000)"],
      colPath: ["Honolulu"],
      period: { year: 1980 },
    });
    expect(at(cells, "B3")).toBeUndefined();
    expect(cells).toHaveLength(6);
  });

  it("splits composite period labels into period + rowPath residue", () => {
    const { cells } = readOne(
      "12.27",
      sheet([
        ["Table 12.27-- EMPLOYMENT AND WAGES:  2022 TO 2023"],
        ["Year and category", "Average employment"],
        ["2022, including gov't", 619741],
        ["2022, excluding gov't", 500000],
        ["2023, including gov't", 620000],
        ...SOURCE,
      ]),
    );
    expect(at(cells, "B4")).toMatchObject({
      rowPath: ["excluding gov't"],
      period: { year: 2022 },
    });
  });

  it("skips interval rows with a warning (01.07)", () => {
    const { table, cells } = readOne(
      "01.07",
      sheet([
        ["Table 1.07-- PERCENTAGE CHANGE IN RESIDENT POPULATION, BY COUNTY, "],
        ["ANNUAL GROWTH RATE, 1990-2000 TO 2010-2020"],
        ["Date", "State total"],
        [2010, 0.014],
        [2011, 0.015],
        ["Date", "State total"],
        ["1990 - 2000", 0.009],
        ["2000 - 2010", 0.012],
        ...SOURCE,
      ]),
    );
    expect(table.title).toContain("ANNUAL GROWTH RATE"); // wrapped title joined
    expect(table.layout).toBe("long");
    expect(table.panels).toHaveLength(2);
    expect(cells).toHaveLength(2);
    expect(table.warnings.join()).toContain("interval");
  });

  it("treats suppression codes as no data and parses numeric strings", () => {
    const { table, cells } = readOne(
      "05.01",
      sheet([
        ["Table 5.01-- THINGS, BY ISLAND:  2024"],
        ["Island", "A", "B", "C", "D"],
        ["Oahu", "(NA)", "(D)", "-", "1,234"],
        ["Maui", "***", "(X)", 5, 6],
        ...SOURCE,
      ]),
    );
    expect(table.layout).toBe("snapshot");
    expect(cells.map((c) => [c.cellAddr, c.value])).toEqual([
      ["05.01!E3", 1234],
      ["05.01!D4", 5],
      ["05.01!E4", 6],
    ]);
    expect(table.warnings.join()).toContain("numeric-string");
  });

  it("classifies rankings and name lists as text and emits nothing", () => {
    const { table, cells } = readOne(
      "01.62",
      sheet([
        ["Table 1.62-- TOP DOMESTIC IN-MIGRATION STATES:  2024"],
        ["Rank", "State", "Movers"],
        [1, "California", 10000],
        [2, "Washington", 5000],
        [3, "Texas", 4000],
        [4, "Nevada", 3000],
        [5, "Oregon", 2000],
        ...SOURCE,
      ]),
    );
    expect(table.layout).toBe("text");
    expect(cells).toHaveLength(0);

    const names = readOne(
      "02.08",
      sheet([
        ["Table 2.08-- MOST COMMON FIRST NAMES:  2024"],
        ["Rank", "Boys", "Girls"],
        ["First", "Noah", "Olivia"],
        ["Second", "Liam", "Emma"],
        ...SOURCE,
      ]),
    );
    expect(names.table.layout).toBe("text");
  });

  it("leaves tables with no period axis as unknown", () => {
    const { table, cells } = readOne(
      "05.13",
      sheet([
        ["Table 5.13-- ELEVATION OF MAJOR SUMMITS"],
        ["Summit", "Feet", "Meters"],
        ["Mauna Kea", 13796, 4205],
        ...SOURCE,
      ]),
    );
    expect(table.layout).toBe("unknown");
    expect(cells).toHaveLength(0);
    expect(table.warnings.join()).toContain("unknown-layout");
  });
});

describe("workbook and files", () => {
  const wb = () =>
    book({
      "Section 1 Table of contents": sheet([["Contents"], ["Table 1.06"]]),
      "Section 1 Narrative": sheet([
        ["SECTION 1: POPULATION"],
        ["        This section presents statistics on the population."],
        ["        The principal sources are the censuses."],
      ]),
      "01.06": sheet(T0106),
    });

  it("skips the contents sheet and returns the narrative", () => {
    const res = readAccessibleWorkbook(wb(), 2025, 1);
    expect(res.tables.map((t) => t.tableNum)).toEqual(["01.06"]);
    expect(res.tables[0]).toMatchObject({ edition: 2025, section: 1 });
    expect(res.narrative).toBe(
      "This section presents statistics on the population.\n\nThe principal sources are the censuses.",
    );
  });

  const dir = mkdtempSync(path.join(tmpdir(), "databook-accessible-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads a section file from disk", () => {
    const file = path.join(dir, sectionFileName(2025, 1));
    writeFileSync(file, XLSX.write(wb(), { type: "buffer", bookType: "xlsx" }));
    const res = readAccessibleSection(file, 2025, 1);
    expect(res.cells).toHaveLength(6);
  });

  it("requires all 24 section files for an edition", () => {
    expect(() => readAccessibleEdition(dir, 2025)).toThrow(/section02/);
  });
});
