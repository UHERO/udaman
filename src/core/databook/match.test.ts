import { describe, expect, it } from "bun:test";

import type { EditionIR, IRCell, IRTable } from "./ir";
import { propose } from "./manifest";
import { matchEditions, needsInterpolation } from "./match";

function table(
  edition: number,
  tableNum: string,
  title: string,
  layout: IRTable["layout"] = "long",
): IRTable {
  return {
    edition,
    section: 1,
    tableNum,
    sheet: tableNum,
    title,
    titlePeriod: "",
    headnote: "",
    footnotes: {},
    source: "Source: U.S. Census Bureau",
    sourceUrl: null,
    layout,
    panels: [{ index: 0, label: "", headers: {} }],
    warnings: [],
  };
}

function cell(
  tableNum: string,
  colPath: string[],
  year: number,
  value: number,
  rowPath: string[] = [],
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
    cellAddr: `${tableNum}!B1`,
    markers: [],
  };
}

const POP: Record<string, number[]> = {
  "State total": [1360304, 1365117, 1385141],
  "City and County of Honolulu": [953203, 957547, 973655],
  "Hawaii County": [185076, 185296, 186775],
};

describe("matchEditions", () => {
  it("follows a renumbered table and a renamed geography column by value overlap", () => {
    const ed2025: EditionIR = {
      edition: 2025,
      tables: [table(2025, "01.06", "RESIDENT POPULATION, BY COUNTY")],
      cells: Object.entries(POP).flatMap(([label, vals]) =>
        vals.map((v, i) => cell("01.06", [label], 2010 + i, v)),
      ),
    };
    // 2024: table was 01.07, Honolulu header worded differently, one revision.
    const ed2024: EditionIR = {
      edition: 2024,
      tables: [table(2024, "01.07", "RESIDENT POPULATION, BY COUNTIES")],
      cells: [
        ...POP["State total"].map((v, i) =>
          cell("01.07", ["State total"], 2010 + i, i === 2 ? v + 5 : v),
        ),
        ...POP["City and County of Honolulu"].map((v, i) =>
          cell("01.07", ["Honolulu County"], 2010 + i, v),
        ),
        ...POP["Hawaii County"].map((v, i) =>
          cell("01.07", ["Hawaii County"], 2010 + i, v),
        ),
        cell("01.07", ["Something unrelated"], 2010, 42),
      ],
    };
    const manifest = propose(ed2025);
    const editions = { 2025: ed2025, 2024: ed2024 } as Record<
      number,
      EditionIR
    >;
    const res = matchEditions(manifest, [2024, 2025], (e) => editions[e]);

    const r2024 = res.rows.filter((r) => r.vintage === 2024);
    const seriesOf = (label: string) =>
      r2024.find((r) => r.colPath[0] === label)?.series;
    expect(seriesOf("State total")).toBe("DB0106@HI.A");
    expect(seriesOf("Honolulu County")).toBe("DB0106@HON.A");
    expect(seriesOf("Hawaii County")).toBe("DB0106@HAW.A");
    expect(seriesOf("Something unrelated")).toBe("");
    expect(r2024.every((r) => r.tableLine === "01.06")).toBe(true);
    expect(r2024.find((r) => r.colPath[0] === "State total")?.vintageDate).toBe(
      "2025-08-01",
    );
    expect(res.editions.get("DB0106@HON.A")).toEqual(new Set([2024, 2025]));
  });

  it("matches snapshot tables by label when there are no shared dates", () => {
    const snap = (
      edition: number,
      num: string,
      year: number,
      v: number,
    ): EditionIR => ({
      edition,
      tables: [
        table(
          edition,
          num,
          "RESIDENT POPULATION BY AGE GROUP, BY COUNTY",
          "snapshot",
        ),
      ],
      cells: [
        cell(num, ["State total"], year, v, ["Under 5 years"]),
        cell(num, ["Hawaii County"], year, v / 7, ["Under 5 years"]),
      ],
    });
    const eds: Record<number, EditionIR> = {
      2025: snap(2025, "01.29", 2025, 73910),
      2024: snap(2024, "01.31", 2024, 76624),
      2023: snap(2023, "01.31", 2023, 78000),
    };
    const manifest = propose(eds[2025]);
    const res = matchEditions(manifest, [2023, 2024, 2025], (e) => eds[e]);
    const name = manifest[0].tables[0].measurements[0].series.find(
      (s) => s.geo === "HI",
    )!.name;
    expect(res.editions.get(name)).toEqual(new Set([2023, 2024, 2025]));
  });
});

describe("matchEditions forward", () => {
  it("matches an edition newer than the manifest edition", () => {
    const ed = (edition: number, num: string, years: number[]): EditionIR => ({
      edition,
      tables: [table(edition, num, "RESIDENT POPULATION, BY COUNTY")],
      cells: Object.entries(POP).flatMap(([label, vals]) =>
        years.map((y, i) => cell(num, [label], y, vals[i] ?? vals[0] + i)),
      ),
    });
    const eds: Record<number, EditionIR> = {
      2025: ed(2025, "01.06", [2010, 2011, 2012]),
      // 2026: renumbered, one new year
      2026: ed(2026, "01.07", [2010, 2011, 2012]),
    };
    const manifest = propose(eds[2025]);
    const res = matchEditions(manifest, [2025, 2026], (e) => eds[e], 2025);
    const r2026 = res.rows.filter((r) => r.vintage === 2026);
    expect(r2026.length).toBeGreaterThan(0);
    expect(r2026.every((r) => r.series.startsWith("DB0106@"))).toBe(true);
    expect(r2026[0].vintageDate).toBe("2027-08-01");
  });
});

describe("needsInterpolation", () => {
  it("flags decennial spacing but not annual series", () => {
    expect(
      needsInterpolation([
        "1990-01-01",
        "2000-01-01",
        "2010-01-01",
        "2020-01-01",
      ]),
    ).toBe(true);
    expect(needsInterpolation(["2017-01-01", "2022-01-01"])).toBe(true);
    expect(
      needsInterpolation([
        "2019-01-01",
        "2020-01-01",
        "2021-01-01",
        "2023-01-01",
      ]),
    ).toBe(false);
    expect(needsInterpolation(["2020-01-01"])).toBe(false);
  });
});
