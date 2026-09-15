import { describe, expect, it } from "bun:test";

import Series from "./series";

/** Build a bare in-memory Series — no DB, no loaders. */
function build(
  frequency: string,
  points: Array<[string, number]>,
  name = "TEST@HI.M",
): Series {
  const s = new Series({ name });
  s.frequency = frequency;
  s.data = new Map(points);
  return s;
}

const dates = (s: Series) => [...s.data.keys()].sort();

describe("Series.getLastIncompleteYear", () => {
  describe("without an explicit cutoff (default behavior)", () => {
    it("trims to January of the last observation's year", () => {
      const s = build("month", [
        ["2023-10-01", 1],
        ["2023-11-01", 2],
        ["2024-01-01", 3],
        ["2024-02-01", 4],
      ]);
      expect(dates(s.getLastIncompleteYear())).toEqual([
        "2024-01-01",
        "2024-02-01",
      ]);
    });

    it("returns nothing when a monthly series ends in December", () => {
      const s = build("month", [
        ["2024-11-01", 1],
        ["2024-12-01", 2],
      ]);
      const r = s.getLastIncompleteYear();
      expect(r.data.size).toBe(0);
      expect(r.name).toBe("No data because no incomplete year");
    });

    it("returns nothing when a quarterly series ends in Q4", () => {
      const s = build("quarter", [
        ["2024-07-01", 1],
        ["2024-10-01", 2],
      ]);
      expect(s.getLastIncompleteYear().data.size).toBe(0);
    });

    it("returns nothing when the series is empty", () => {
      expect(build("month", []).getLastIncompleteYear().data.size).toBe(0);
    });
  });

  describe("with an explicit cutoff", () => {
    it("keeps everything from the cutoff forward", () => {
      const s = build("month", [
        ["2021-11-01", 1],
        ["2021-12-01", 2],
        ["2022-01-01", 3],
        ["2022-06-01", 4],
      ]);
      expect(dates(s.getLastIncompleteYear("2022-01-01"))).toEqual([
        "2022-01-01",
        "2022-06-01",
      ]);
    });

    // The reason the parameter exists: a forced cutoff must be able to emit a
    // period the December guard would otherwise discard, so a self-referential
    // eval can recover the anchor it needs to advance past a gap.
    it("bypasses the December guard", () => {
      const s = build("month", [
        ["2021-12-01", 1],
        ["2022-06-01", 2],
        ["2022-12-01", 3],
      ]);
      const r = s.getLastIncompleteYear("2022-01-01");
      expect(dates(r)).toEqual(["2022-06-01", "2022-12-01"]);
      expect(r.name).not.toBe("No data because no incomplete year");
    });

    it("keeps all data when the cutoff precedes every observation", () => {
      const s = build("month", [
        ["2022-01-01", 1],
        ["2022-12-01", 2],
      ]);
      expect(s.getLastIncompleteYear("1900-01-01").data.size).toBe(2);
    });

    it("falls back to default behavior for empty-ish cutoffs", () => {
      const s = build("month", [
        ["2024-06-01", 1],
        ["2024-12-01", 2],
      ]);
      // null/undefined/"" must not be mistaken for a cutoff
      for (const arg of [null, undefined, ""]) {
        expect(s.getLastIncompleteYear(arg).data.size).toBe(0);
      }
    });
  });
});
