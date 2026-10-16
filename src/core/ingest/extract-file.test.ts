import { describe, expect, test } from "bun:test";

import {
  indexExtract,
  parseExtract,
  serializeExtract,
  seriesKey,
} from "./extract-file";
import { normalizeLabel, stripFootnotes } from "./labels";
import { stableStringify } from "./run";
import { validateExtract } from "./validate";

describe("extract file", () => {
  const dims = ["type", "source"];
  const rows = [
    {
      dims: { type: "collec", source: 'Mtr. Vehicle Tax/Fees, etc. "x"' },
      date: "2025-02-01",
      value: 2,
    },
    {
      dims: { type: "collec", source: "Fuel" },
      date: "2025-01-01",
      value: 49940438.00000001,
    },
    {
      dims: { type: "collec", source: 'Mtr. Vehicle Tax/Fees, etc. "x"' },
      date: "2025-01-01",
      value: -1.5,
    },
  ];

  test("sorted by series then date, quoted, float noise rounded", () => {
    expect(serializeExtract(dims, rows)).toBe(
      [
        "type,source,date,value",
        "collec,Fuel,2025-01-01,49940438",
        'collec,"Mtr. Vehicle Tax/Fees, etc. ""x""",2025-01-01,-1.5',
        'collec,"Mtr. Vehicle Tax/Fees, etc. ""x""",2025-02-01,2',
        "",
      ].join("\n"),
    );
  });

  test("round trip and index", () => {
    const parsed = parseExtract(serializeExtract(dims, rows));
    expect(parsed.dims).toEqual(dims);
    const index = indexExtract(parsed);
    expect(index.series.size).toBe(2);
    const s = index.series.get(seriesKey(dims, rows[0].dims))!;
    expect([...s.data]).toEqual([
      ["2025-01-01", -1.5],
      ["2025-02-01", 2],
    ]);
  });

  test("a file without date,value at the end is not an extract", () => {
    expect(() => parseExtract("a,b\n1,2\n")).toThrow(/not an extract file/);
  });
});

describe("labels", () => {
  test("normalizeLabel never renames", () => {
    expect(normalizeLabel("  Hawai‘i   Island – “North” ")).toBe(
      `Hawai'i Island - "North"`,
    );
  });

  test("stripFootnotes", () => {
    expect(stripFootnotes("Fuel 6/")).toBe("Fuel");
    expect(stripFootnotes("TOTAL 1/, 7/")).toBe("TOTAL");
    expect(stripFootnotes("Tobacco ***")).toBe("Tobacco");
    expect(stripFootnotes("Kauai (p)")).toBe("Kauai");
    expect(stripFootnotes("SUB-TOTAL 1")).toBe("SUB-TOTAL 1");
  });
});

describe("validateExtract", () => {
  const ok = (rows: Parameters<typeof validateExtract>[0]) =>
    validateExtract(rows, {
      dims: ["k"],
      config: {},
      previous: null,
      today: "2026-10-14",
    })
      .filter((r) => !r.passed)
      .map((r) => r.check);

  test("columns must be exactly the declared dimensions", () => {
    expect(
      ok([{ dims: { k: "a", extra: "x" }, date: "2025-01-01", value: 1 }]),
    ).toEqual(["columns"]);
    expect(ok([{ dims: { k: "" }, date: "2025-01-01", value: 1 }])).toEqual([
      "columns",
    ]);
  });

  test("dates must be real and plausible", () => {
    expect(ok([{ dims: { k: "a" }, date: "2025-02-30", value: 1 }])).toEqual([
      "dates",
    ]);
    expect(ok([{ dims: { k: "a" }, date: "2029-01-01", value: 1 }])).toEqual([
      "dates",
    ]);
    expect(ok([{ dims: { k: "a" }, date: "2028-01-01", value: 1 }])).toEqual(
      [],
    );
  });

  test("no rows is a failure", () => {
    expect(ok([])).toEqual(["not_empty"]);
  });
});

test("stableStringify sorts keys", () => {
  expect(stableStringify({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(
    '{"a":[{"c":2,"d":1}],"b":1}',
  );
});
