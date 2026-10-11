import { describe, expect, it } from "bun:test";

import { assignGeographies, resolveAxis, titleGeo } from "./geoassign";
import type { IRCell } from "./ir";

const handles = (labels: string[]) =>
  Object.fromEntries([...resolveAxis(labels)].map(([l, h]) => [l, h.handle]));

function cell(panel: number, rowPath: string[], colPath: string[]): IRCell {
  return {
    tableNum: "01.49",
    panel,
    rowPath,
    colPath,
    period: {
      label: "2020",
      year: 2020,
      date: "2020-01-01",
      basis: "calendar",
    },
    value: 1,
    cellAddr: "01.49!B1",
    markers: [],
  };
}

describe("resolveAxis", () => {
  it("keeps county and island geographies distinct (a named county's bare name is its island)", () => {
    expect(
      handles([
        "State total",
        "City and County of Honolulu",
        "Hawaii County",
        "Maui County",
        "Oahu",
        "Maui",
        "Molokai",
        "Lanai",
        "Kauai",
      ]),
    ).toEqual({
      "State total": "HI",
      "City and County of Honolulu": "HON",
      "Hawaii County": "HAW",
      "Maui County": "MAU",
      Oahu: "OAHU",
      Maui: "MAUI",
      Molokai: "MOL",
      Lanai: "LAN",
      Kauai: "KAU",
    });
  });

  it("reads bare names as islands next to island-only names", () => {
    expect(handles(["Hawaii", "Maui", "Oahu", "Kauai", "Molokai"])).toEqual({
      Hawaii: "HAWI",
      Maui: "MAUI",
      Oahu: "OAHU",
      Kauai: "KAUI",
      Molokai: "MOL",
    });
  });

  it("reads Hawaii as the state next to the U.S.", () => {
    expect(handles(["Hawaii", "United States"])).toEqual({
      Hawaii: "HI",
      "United States": "US",
    });
  });

  it("does not treat visitor markets as geographies", () => {
    expect(
      handles(["U.S. total", "U.S. West", "U.S. East", "Japan", "Canada"]),
    ).toEqual({});
  });

  it("splits geographies off shared residues", () => {
    const r = resolveAxis([
      "All exemptions, Statewide",
      "All exemptions, Oahu",
      "All exemptions, Maui",
    ]);
    expect(r.get("All exemptions, Statewide")).toEqual({
      handle: "HI",
      residue: "All exemptions",
    });
    expect(r.get("All exemptions, Oahu")).toEqual({
      handle: "OAHU",
      residue: "All exemptions",
    });
    expect(handles(["Oahu: male", "Oahu: female", "Maui: male"])).toEqual({
      "Oahu: male": "OAHU",
      "Oahu: female": "OAHU",
      "Maui: male": "MAUI",
    });
  });

  it("ignores a lone geography-looking phrase without siblings", () => {
    expect(
      handles([
        "Large cities Urban Honolulu",
        "Large cities Boston",
        "Overall",
      ]),
    ).toEqual({});
  });

  it("keeps only Hawaii and the U.S. in by-state lists", () => {
    const states = [
      "Alabama",
      "Alaska",
      "Arizona",
      "Arkansas",
      "California",
      "Colorado",
      "Connecticut",
      "Delaware",
      "Florida",
      "Georgia",
      "Idaho",
      "Illinois",
      "Indiana",
      "Iowa",
      "Kansas",
      "Kentucky",
      "Louisiana",
      "Maine",
      "Maryland",
      "Massachusetts",
      "Hawaii",
      "United States",
    ];
    expect(handles(states)).toEqual({ Hawaii: "HI", "United States": "US" });
  });
});

describe("assignGeographies", () => {
  it("merges County and Island panels into one metric with all geographies (01.49)", () => {
    const cells = [
      cell(0, ["State total"], ["Households"]),
      cell(0, ["City and County of Honolulu"], ["Households"]),
      cell(0, ["Maui County"], ["Households"]),
      cell(1, ["Oahu"], ["Households"]),
      cell(1, ["Maui"], ["Households"]),
      cell(1, ["Lanai"], ["Households"]),
    ];
    const out = assignGeographies(cells, (c) =>
      c.panel === 0 ? "County" : "Island",
    );
    expect(out.map((a) => [a.geo, a.panelDim, a.rowDims, a.colDims])).toEqual([
      ["HI", "", [], ["Households"]],
      ["HON", "", [], ["Households"]],
      ["MAU", "", [], ["Households"]],
      ["OAHU", "", [], ["Households"]],
      ["MAUI", "", [], ["Households"]],
      ["LAN", "", [], ["Households"]],
    ]);
  });

  it("finds geographies above the leaf and keeps sub-areas as dimensions", () => {
    const cells = [
      cell(0, ["State total"], []),
      cell(0, ["State total", "Hawaii County"], []),
      cell(0, ["State total", "Hawaii County", "Puna"], []),
      cell(0, ["State total", "Kauai County"], []),
    ];
    const out = assignGeographies(cells, () => "");
    expect(out.map((a) => [a.geo, a.rowDims])).toEqual([
      ["HI", []],
      ["HAW", []],
      ["HAW", ["Puna"]],
      ["KAU", []],
    ]);
  });

  it("reads a geography from the panel label", () => {
    const cells = [cell(0, ["Murder"], []), cell(1, ["Murder"], [])];
    const out = assignGeographies(cells, (c) =>
      c.panel === 0 ? "Type of offense for State" : "Type of offense for Oahu",
    );
    expect(out.map((a) => [a.geo, a.panelDim])).toEqual([
      ["HI", "Type of offense"],
      ["OAHU", "Type of offense"],
    ]);
  });

  it("drops separate Kalawao rows (folded into Maui County)", () => {
    const out = assignGeographies(
      [
        cell(0, ["Maui County"], []),
        cell(0, ["Kalawao"], []),
        cell(0, ["State total"], []),
      ],
      () => "",
    );
    expect(out.map((a) => a.geo)).toEqual(["MAU", "HI"]);
  });
});

describe("single geographies and by-state lists", () => {
  it("keeps a lone explicit county/island but not a lone bare or U.S. label", () => {
    expect(
      handles(["Total", "City & County of Honolulu", "Other counties"]),
    ).toEqual({
      Total: "HI",
      "City & County of Honolulu": "HON",
    });
    expect(
      handles(["Oahu total", "1 Hawaii Kai", "2 Kuliouou-Kalani Iki"]),
    ).toEqual({
      "Oahu total": "OAHU",
    });
    expect(handles(["Hawaii", "Japan"])).toEqual({});
    expect(handles(["U.S. total", "Japan"])).toEqual({});
  });

  it("drops other states' cells in by-state tables", () => {
    const states = [
      "Alabama",
      "Alaska",
      "Arizona",
      "Arkansas",
      "California",
      "Colorado",
      "Connecticut",
      "Delaware",
      "Florida",
      "Georgia",
      "Idaho",
      "Illinois",
      "Indiana",
      "Iowa",
      "Kansas",
      "Kentucky",
      "Louisiana",
      "Maine",
      "Maryland",
      "Massachusetts",
    ];
    const cells = [...states, "Hawaii", "United States"].map((s) =>
      cell(0, [s], ["Real SPI"]),
    );
    const out = assignGeographies(cells, () => "");
    expect(out.map((a) => [a.geo, a.rowDims, a.colDims])).toEqual([
      ["HI", [], ["Real SPI"]],
      ["US", [], ["Real SPI"]],
    ]);
  });
});

describe("composite labels", () => {
  it("rejects institution names and multi-place labels", () => {
    expect(
      handles([
        "Hawaii Community College",
        "University of Hawaii",
        "Hawaii Pacific University",
        "Chaminade",
      ]),
    ).toEqual({});
    expect(handles(["State government", "County of Kauai", "Private"])).toEqual(
      {
        "County of Kauai": "KAU",
      },
    );
    expect(handles(["Hawaii, Kauai, Oahu", "Kauai", "Oahu"])).toEqual({
      Kauai: "KAUI",
      Oahu: "OAHU",
    });
  });

  it("keeps delimited and shared-residue splits", () => {
    const r = resolveAxis(["First (Oahu)", "Second (Oahu)", "First (Maui)"]);
    expect(r.get("First (Oahu)")).toEqual({ handle: "OAHU", residue: "First" });
    expect(
      handles([
        "Hawaii per capita personal income (dollars)",
        "United States per capita personal income (dollars)",
      ]),
    ).toEqual({
      "Hawaii per capita personal income (dollars)": "HI",
      "United States per capita personal income (dollars)": "US",
    });
  });
});

function at(addr: string, rowPath: string[], colPath: string[], value = 1) {
  return { ...cell(0, rowPath, colPath), cellAddr: `01.01!${addr}`, value };
}

describe("one measurement per metric", () => {
  it("reads a metric-labelled first column as the state (01.01)", () => {
    const out = assignGeographies(
      [
        at("B6", [], ["Population (number)"]),
        at("C6", [], ["Population (percent change)"]),
        at("D6", [], ["Honolulu County"]),
        at("E6", [], ["Hawaii County"]),
        at("F6", [], ["Kauai County"]),
        at("G6", [], ["Maui County"]),
      ],
      () => "",
    );
    expect(out.map((a) => [a.geo, a.colDims])).toEqual([
      ["HI", ["Population (number)"]],
      ["HON", ["Population (number)"]],
      ["HAW", ["Population (number)"]],
      ["KAU", ["Population (number)"]],
      ["MAU", ["Population (number)"]],
    ]);
  });

  it("reads a '…, total' row before a county run as the state (04.04)", () => {
    const out = assignGeographies(
      [
        at("B4", ["Index Offenses, total"], []),
        at("B5", ["Honolulu"], []),
        at("B6", ["Hawaii"], []),
        at("B9", ["Part II Offenses, total"], []),
        at("B10", ["Honolulu (2)"], []),
        at("B11", ["Hawaii (2)"], []),
      ],
      () => "",
    );
    expect(out.map((a) => [a.geo, a.rowDims])).toEqual([
      ["HI", ["Index Offenses, total"]],
      ["HON", ["Index Offenses, total"]],
      ["HAW", ["Index Offenses, total"]],
      ["HI", ["Part II Offenses, total"]],
      ["HON", ["Part II Offenses, total"]],
      ["HAW", ["Part II Offenses, total"]],
    ]);
  });

  it("does not take an unrelated label as the state", () => {
    const out = assignGeographies(
      [
        at("B4", ["Governor"], []),
        at("B5", ["Mayor"], ["Honolulu"]),
        at("B6", ["Mayor"], ["Hawaii"]),
      ],
      () => "",
    );
    expect(out.map((a) => [a.geo, a.rowDims, a.colDims])).toEqual([
      ["HI", ["Governor"], []],
      ["HON", ["Mayor"], []],
      ["HAW", ["Mayor"], []],
    ]);
  });

  it("merges period/geography-only panel labels (18.17, 19.10)", () => {
    const out = assignGeographies(
      [
        cell(0, [], ["Fuel"]),
        cell(1, ["Honolulu"], ["Fuel"]),
        cell(1, ["Maui"], ["Fuel"]),
      ],
      (c) => (c.panel === 0 ? "Year" : "County: 2024"),
    );
    expect(out.map((a) => [a.geo, a.panelDim])).toEqual([
      ["HI", ""],
      ["HON", ""],
      ["MAU", ""],
    ]);
    const farm = assignGeographies(
      [cell(0, [], ["Farm jobs"]), cell(1, [], ["Farm jobs"])],
      (c) => (c.panel === 0 ? "State by year" : "Hawaii County by year"),
    );
    expect(farm.map((a) => [a.geo, a.panelDim])).toEqual([
      ["HI", ""],
      ["HAW", ""],
    ]);
  });

  it("uses a single-place title as the default geography", () => {
    expect(titleGeo("RESIDENT POPULATION FOR OAHU NEIGHBORHOODS")).toBe("OAHU");
    expect(titleGeo("HONOLULU CONSTRUCTION COST INDEXES")).toBe("HON");
    expect(titleGeo("DISABILITY STATUS, FOR THE STATE AND OAHU")).toBeNull();
    expect(
      titleGeo("COST OF LIVING ANALYSES FOR HONOLULU AND THE UNITED STATES"),
    ).toBeNull();
    const out = assignGeographies([cell(0, ["Hawaii Kai"], [])], () => "", {
      title: "RESIDENT POPULATION FOR OAHU NEIGHBORHOODS",
    });
    expect(out.map((a) => [a.geo, a.rowDims])).toEqual([
      ["OAHU", ["Hawaii Kai"]],
    ]);
  });

  it("drops percent-change cells", () => {
    expect(
      assignGeographies([cell(0, [], ["Hawaii percent change"])], () => ""),
    ).toEqual([]);
  });

  it("reads Oahu as Honolulu County among counties, bare Honolulu only with siblings", () => {
    expect(
      handles(["Total Hawaii income", "Oahu income", "Maui County income"]),
    ).toEqual({
      "Total Hawaii income": "HI",
      "Oahu income": "HON",
      "Maui County income": "MAU",
    });
    expect(handles(["Honolulu", "Hilo", "Kahului", "Kawaihae"])).toEqual({});
  });

  it("lets the axis with more geographies win (06.06)", () => {
    const out = assignGeographies(
      [
        cell(0, ["Government - State total"], ["Oahu"]),
        cell(0, ["Government - State total"], ["Maui"]),
        cell(0, ["Government - State total"], ["Lanai"]),
        cell(0, ["Government - County total"], ["Oahu"]),
      ],
      () => "",
    );
    expect(out.map((a) => [a.geo, a.rowDims])).toEqual([
      ["OAHU", ["Government - State total"]],
      ["MAUI", ["Government - State total"]],
      ["LAN", ["Government - State total"]],
      ["OAHU", ["Government - County total"]],
    ]);
  });
});

describe("nested places (01.12)", () => {
  it("reads an island list as islands and a county-named place under an island as a place", () => {
    const out = assignGeographies(
      [
        cell(0, ["Hawaii"], ["Resident population"]),
        cell(0, ["Hawaii", "Hilo"], ["Resident population"]),
        cell(0, ["Maui"], ["Resident population"]),
        cell(0, ["Lanai"], ["Resident population"]),
        cell(0, ["Oahu"], ["Resident population"]),
        cell(0, ["Oahu", "Urban Honolulu"], ["Resident population"]),
      ],
      () => "",
    );
    expect(out.map((a) => [a.geo, a.rowDims])).toEqual([
      ["HAWI", []],
      ["HAWI", ["Hilo"]],
      ["MAUI", []],
      ["LAN", []],
      ["OAHU", []],
      ["OAHU", ["Urban Honolulu"]],
    ]);
  });
});
