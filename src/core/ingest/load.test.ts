import EvalParser from "@catalog/utils/eval-parser";
import { describe, expect, test } from "bun:test";

import { indexExtract } from "./extract-file";
import { closest, frequencyOfName, matchSeries } from "./load";
import { extractCallsIn, findExtractCalls } from "./references";

const dotax = indexExtract({
  dims: ["type", "tax", "source", "area"],
  rows: [
    ["collec", "Income-Ind.", "Refunds", "State", 1],
    ["collec", "Income-Ind.", "Refunds", "Maui", 2],
    ["collec", "Income-Corp.", "Refunds", "State", 3],
    ["collec", "General Excise & Use", "General Excise & Use", "State", 4],
    ["fuels", "State Tax", "Aviation fuel", "Kauai", 5],
  ].map(([type, tax, source, area, v]) => ({
    dims: { type, tax, source, area } as Record<string, string>,
    date: "2025-07-01",
    value: v as number,
  })),
});
const DIMS = ["type", "tax", "source", "area"];

const bls = indexExtract({
  dims: ["series_id", "frequency"],
  rows: [
    {
      dims: { series_id: "CUUR0000SA0", frequency: "M" },
      date: "2025-01-01",
      value: 1,
    },
    {
      dims: { series_id: "CUUR0000SA0", frequency: "S" },
      date: "2025-01-01",
      value: 2,
    },
    {
      dims: { series_id: "LNU04000000", frequency: "M" },
      date: "2025-01-01",
      value: 3,
    },
  ],
});

const match = (filters: unknown, ctx = {}) =>
  matchSeries("dotax", DIMS, dotax, filters, ctx, "M");

describe("matchSeries", () => {
  test("exactly one series", () => {
    const m = match({
      type: "collec",
      tax: "Income-Ind.",
      source: "Refunds",
      area: "Maui",
    });
    expect(m.ok && [...m.series.data.values()]).toEqual([2]);
    expect(m.ok && m.frequency).toBe("M");
  });

  test("labels go through the same normalization as the extract", () => {
    const m = match({
      type: "collec",
      tax: "General  Excise & Use",
      source: " General Excise & Use",
      area: "State",
    });
    expect(m.ok).toBe(true);
  });

  test("zero matches names the filter and suggests the closest label", () => {
    const m = match({
      type: "collec",
      tax: "Income-Ind.",
      source: "Refundz",
      area: "State",
    });
    expect(m.ok).toBe(false);
    if (m.ok) return;
    expect(m.reason).toBe("none");
    expect(m.message).toContain('no series with source "Refundz"');
    expect(m.message).toContain('closest source: "Refunds"');
  });

  test("more than one match lists what still varies", () => {
    const m = match({ type: "collec", source: "Refunds" });
    expect(m.ok).toBe(false);
    if (m.ok) return;
    expect(m.reason).toBe("many");
    expect(m.message).toContain("matches 3 series");
    expect(m.message).toContain('tax ("Income-Ind.", "Income-Corp.")');
    expect(m.message).toContain('area ("State", "Maui")');
  });

  test("keys must be declared dimensions; filters must be an object", () => {
    const bad = match({ type: "collec", county: "Maui" });
    expect(!bad.ok && bad.message).toContain('unknown filter "county"');
    expect(!bad.ok && bad.message).toContain(
      "filters by type, tax, source, area",
    );
    expect(match("collec").ok).toBe(false);
    expect(match({}).ok).toBe(false);
    expect(match(undefined).ok).toBe(false);
  });

  test("the target series' frequency must match the source's", () => {
    const m = match(
      { type: "fuels", source: "Aviation fuel" },
      { seriesName: "TFAVNS@KAU.Q" },
    );
    expect(!m.ok && m.message).toContain(
      "TFAVNS@KAU.Q is Q but the extract series is M",
    );
  });

  test("a frequency dimension is filled in from the series name", () => {
    const m = matchSeries(
      "bls",
      ["series_id", "frequency"],
      bls,
      { series_id: "CUUR0000SA0" },
      {
        seriesName: "CPI@US.S",
      },
    );
    expect(m.ok && [...m.series.data.values()]).toEqual([2]);
    // without a series name both frequencies match
    const many = matchSeries("bls", ["series_id", "frequency"], bls, {
      series_id: "CUUR0000SA0",
    });
    expect(!many.ok && many.message).toContain('frequency ("M", "S")');
  });
});

test("frequencyOfName", () => {
  expect(frequencyOfName("TGBRTNS@HI.M")).toBe("M");
  expect(frequencyOfName("E_NF@HON.q")).toBe("Q");
  expect(frequencyOfName("not a name")).toBeNull();
});

test("closest", () => {
  expect(closest("Refundz", ["Refunds", "Rentals", "Retailing"], 1)).toEqual([
    "Refunds",
  ]);
});

describe("finding load_from_extract calls", () => {
  test("in chained and arithmetic evals, JS and Ruby hash syntax", () => {
    const calls = extractCallsIn(
      `Series.load_from_extract("dotax", { type: "collec", tax: "Mtr. Vehicle Tax/Fees, etc.", source: "Fuel" }).trim("2002-01-01") * 1000 + Series.load_from_extract("bls", { :series_id => "CUUR0000SA0" })`,
    );
    expect(calls).toEqual([
      {
        handle: "dotax",
        filters: {
          type: "collec",
          tax: "Mtr. Vehicle Tax/Fees, etc.",
          source: "Fuel",
        },
      },
      { handle: "bls", filters: { series_id: "CUUR0000SA0" } },
    ]);
  });

  test("a string-keyed hash parses to no filters (caught by validation)", () => {
    const [call] = findExtractCalls(
      EvalParser.parse(
        `Series.load_from_extract("dotax", { "type" => "collec" })`,
      ),
    );
    expect(call.filters).toEqual({});
    expect(match(call.filters).ok).toBe(false);
  });
});
