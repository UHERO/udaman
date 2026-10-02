import { describe, expect, test } from "bun:test";

import { formatChange, formatLatestValue } from "./series-preview";

describe("formatLatestValue", () => {
  test("applies decimals, separators and units", () => {
    expect(
      formatLatestValue({
        value: 812345.04,
        decimals: 1,
        unitsLabel: "persons",
      }),
    ).toBe("812,345.0 persons");
  });

  test("percent sign attaches without a space", () => {
    expect(formatLatestValue({ value: 2.6, unitsLabel: "%" })).toBe("2.6%");
  });

  test("omits missing units", () => {
    expect(formatLatestValue({ value: 3.14159, decimals: 2 })).toBe("3.14");
  });
});

describe("formatChange", () => {
  test("percent change with direction", () => {
    expect(formatChange({ value: 102.1, prevValue: 100 })).toBe("▲ 2.1%");
    expect(formatChange({ value: 95, prevValue: 100 })).toBe("▼ 5.0%");
  });

  test("percent-valued series report points", () => {
    expect(
      formatChange({ value: 3.1, prevValue: 3.4, percent: true, decimals: 1 }),
    ).toBe("▼ 0.3 pts");
  });

  test("negative base uses its magnitude", () => {
    expect(formatChange({ value: -50, prevValue: -100 })).toBe("▲ 50.0%");
  });

  test("null without a usable prior value", () => {
    expect(formatChange({ value: 1 })).toBeNull();
    expect(formatChange({ value: 1, prevValue: null })).toBeNull();
    expect(formatChange({ value: 1, prevValue: 0 })).toBeNull();
  });

  test("unchanged", () => {
    expect(formatChange({ value: 7, prevValue: 7 })).toBe("unchanged");
  });
});
