import { describe, expect, it } from "bun:test";

import type { EditionIR, IRCell, IRTable } from "./ir";
import { propose } from "./manifest";

function table(over: Partial<IRTable>): IRTable {
  return {
    edition: 2025,
    section: 1,
    tableNum: "01.06",
    sheet: "01.06",
    title: "RESIDENT POPULATION, BY COUNTY",
    titlePeriod: "2010 TO 2025",
    headnote: "",
    footnotes: {},
    source: "Source: U.S. Census Bureau, records <https://www.census.gov/x>",
    sourceUrl: "https://www.census.gov/x",
    layout: "long",
    panels: [{ index: 0, label: "", headers: {} }],
    warnings: [],
    ...over,
  };
}

function cell(
  tableNum: string,
  col: string,
  row: number,
  rowPath: string[],
  colPath: string[],
  year: number,
  value: number,
  extra: Partial<IRCell> = {},
): IRCell {
  return {
    tableNum,
    panel: 0,
    rowPath,
    colPath,
    period: {
      label: String(year),
      year,
      date: `${year}-01-01`,
      basis: "calendar",
    },
    value,
    cellAddr: `${tableNum}!${col}${row}`,
    numFmt: "#,##0",
    markers: [],
    ...extra,
  };
}

describe("propose", () => {
  it("collapses geography columns into one measurement with geo series", () => {
    const geos: Array<[string, string]> = [
      ["B", "State total"],
      ["C", "City and County of Honolulu"],
      ["D", "Hawaii County"],
      ["E", "Kauai County"],
      ["F", "Maui County"],
    ];
    const cells = [2024, 2025].flatMap((y, i) =>
      geos.map(([col, label]) =>
        cell("01.06", col, 6 + i, [], [label], y, 1000 + i),
      ),
    );
    const ir: EditionIR = { edition: 2025, tables: [table({})], cells };
    const [sec] = propose(ir);
    expect(sec.name).toBe("Population");
    const [m] = sec.tables[0].measurements;
    expect(m.prefix).toBe("DB0106");
    expect(m.series.map((s) => s.name)).toEqual([
      "DB0106@HI.A",
      "DB0106@HON.A",
      "DB0106@HAW.A",
      "DB0106@KAU.A",
      "DB0106@MAU.A",
    ]);
    expect(m.dataPortalName).toBe("Resident Population");
    expect(sec.tables[0].source.agency).toBe("DBEDT State of Hawaii Data Book");
    expect(sec.tables[0].source.originalAgency).toBe("U.S. Census Bureau");
    expect(sec.tables[0].source.detail).toBe(
      "Data Book Table 1.06 (2025 edition). Original source: U.S. Census Bureau, records <https://www.census.gov/x>",
    );
  });

  it("uses column letters for plain long tables", () => {
    const cells = [
      cell("01.04", "B", 7, [], ["Resident population total"], 2024, 1),
      cell("01.04", "F", 7, [], ["De facto-resident ratio"], 2024, 1.1, {
        numFmt: "0.00",
      }),
    ];
    const ir: EditionIR = {
      edition: 2025,
      tables: [
        table({ tableNum: "01.04", title: "RESIDENT AND DE FACTO POPULATION" }),
      ],
      cells,
    };
    const ms = propose(ir)[0].tables[0].measurements;
    expect(ms.map((m) => m.prefix)).toEqual(["DB0104B", "DB0104F"]);
    expect(ms[1].decimals).toBe(2);
  });

  it("maps geography rows and drops sub-county rows beneath them", () => {
    const cells = [
      cell("01.11", "C", 4, ["State total"], [], 2020, 100),
      cell("01.11", "C", 5, ["State total", "Hawaii County"], [], 2020, 30),
      cell(
        "01.11",
        "C",
        6,
        ["State total", "Hawaii County", "Puna"],
        [],
        2020,
        5,
      ),
      cell(
        "01.11",
        "C",
        15,
        ["State total", "City & County of Honolulu"],
        [],
        2020,
        70,
      ),
    ];
    const ir: EditionIR = {
      edition: 2025,
      tables: [
        table({
          tableNum: "01.11",
          layout: "wide",
          title: "RESIDENT POPULATION OF COUNTIES",
        }),
      ],
      cells,
    };
    const ms = propose(ir)[0].tables[0].measurements;
    const names = ms.flatMap((m) => m.series.map((s) => s.name));
    expect(names).not.toContain(expect.stringContaining("Puna"));
    expect(names.length).toBe(3);
    expect(new Set(ms.flatMap((m) => m.series.map((s) => s.geo)))).toEqual(
      new Set(["HI", "HAW", "HON"]),
    );
  });

  it("flags snapshot series and marks percent formats", () => {
    const cells = [
      cell("01.29", "B", 5, ["Under 5 years"], ["State total"], 2025, 0.05, {
        numFmt: "0.0%",
      }),
      cell(
        "01.29",
        "D",
        5,
        ["Under 5 years"],
        ["City and County of Honolulu"],
        2025,
        0.052,
        {
          numFmt: "0.0%",
        },
      ),
    ];
    const ir: EditionIR = {
      edition: 2025,
      tables: [
        table({ tableNum: "01.29", layout: "snapshot", titlePeriod: "2025" }),
      ],
      cells,
    };
    const [m] = propose(ir)[0].tables[0].measurements;
    expect(m.prefix).toBe("DB0129R01");
    expect(m.percent).toBe(true);
    expect(m.decimals).toBe(1);
    expect(m.unit.longLabel).toBe("Percent");
    expect(m.series.every((s) => s.snapshot)).toBe(true);
  });

  it("keeps previously assigned prefixes", () => {
    const cells = [
      cell("01.04", "B", 7, [], ["Resident population total"], 2024, 1),
    ];
    const ir: EditionIR = {
      edition: 2025,
      tables: [table({ tableNum: "01.04" })],
      cells,
    };
    const first = propose(ir);
    first[0].tables[0].measurements[0].prefix = "DB0104X";
    first[0].tables[0].measurements[0].series[0].name = "DB0104X@HI.A";
    const again = propose(ir, { previous: first });
    expect(again[0].tables[0].measurements[0].prefix).toBe("DB0104X");
  });
});
