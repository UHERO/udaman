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

describe("Series.fillMissingLinear", () => {
  it("fills decennial annual gaps with only the interpolated years", () => {
    const s = build(
      "year",
      [
        ["2000-01-01", 100],
        ["2010-01-01", 200],
        ["2020-01-01", 150],
      ],
      "TEST@HI.A",
    );
    const r = s.fillMissingLinear();
    expect(r.frequency).toBe("year");
    expect(r.data.size).toBe(18);
    expect(r.data.has("2000-01-01")).toBe(false);
    expect(r.data.has("2010-01-01")).toBe(false);
    expect(r.data.get("2001-01-01")).toBeCloseTo(110);
    expect(r.data.get("2009-01-01")).toBeCloseTo(190);
    expect(r.data.get("2015-01-01")).toBeCloseTo(175);
  });

  it("never extrapolates past the first or last observation", () => {
    const s = build(
      "year",
      [
        ["2017-01-01", 10],
        ["2022-01-01", 20],
      ],
      "TEST@HI.A",
    );
    expect(dates(s.fillMissingLinear())).toEqual([
      "2018-01-01",
      "2019-01-01",
      "2020-01-01",
      "2021-01-01",
    ]);
  });

  it("returns nothing for a series without gaps", () => {
    const s = build(
      "quarter",
      [
        ["2024-01-01", 1],
        ["2024-04-01", 2],
        ["2024-07-01", 3],
      ],
      "TEST@HI.Q",
    );
    expect(s.fillMissingLinear().data.size).toBe(0);
  });

  it("steps by the series frequency (quarterly)", () => {
    const s = build(
      "Q",
      [
        ["2024-01-01", 0],
        ["2025-01-01", 4],
      ],
      "TEST@HI.Q",
    );
    const r = s.fillMissingLinear();
    expect(dates(r)).toEqual(["2024-04-01", "2024-07-01", "2024-10-01"]);
    expect(r.data.get("2024-07-01")).toBeCloseTo(2);
  });

  it("rejects unsupported frequencies", () => {
    expect(() =>
      build("bogus", [["2024-01-01", 1]]).fillMissingLinear(),
    ).toThrow();
  });
});

describe("Series.aggregate to week", () => {
  // 2026-02-01 is a Sunday; Feb 1..24 daily, values = day of month.
  const febDays = (): Array<[string, number]> =>
    Array.from({ length: 24 }, (_, i) => [
      `2026-02-${String(i + 1).padStart(2, "0")}`,
      i + 1,
    ]);

  it("keys Sunday–Saturday weeks by their ending Saturday (Rails week_d)", () => {
    const w = build("day", febDays(), "TEST@HI.D").aggregate("week", "sum");
    expect(dates(w)).toEqual(["2026-02-07", "2026-02-14", "2026-02-21"]);
    expect(w.data.get("2026-02-07")).toBe(1 + 2 + 3 + 4 + 5 + 6 + 7);
    expect(w.data.get("2026-02-21")).toBe(15 + 16 + 17 + 18 + 19 + 20 + 21);
  });

  it("drops the trailing week until its Saturday is observed", () => {
    const w = build("day", febDays(), "TEST@HI.D").aggregate("week", "sum");
    expect(w.data.has("2026-02-28")).toBe(false);
  });

  it("drops a leading week the data starts partway through", () => {
    const w = build("day", febDays().slice(2), "TEST@HI.D").aggregate(
      "week",
      "sum",
    );
    expect(dates(w)).toEqual(["2026-02-14", "2026-02-21"]);
  });
});

describe("Series.aggregate from week", () => {
  // Saturdays Jan 3 .. Feb 28 2026; each covers the 7 days ending on it.
  const saturdays = (value: number): Array<[string, number]> =>
    Array.from({ length: 9 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 3 + 7 * i));
      return [d.toISOString().slice(0, 10), value];
    });

  it("splits a week that straddles months by its days (sum)", () => {
    const m = build("week", saturdays(7), "TEST@HI.W").aggregate(
      "month",
      "sum",
    );
    // Jan 3 covers Dec 28–Jan 3: December is partial (dropped), January
    // complete. Each day carries 7/7 = 1.
    expect(dates(m)).toEqual(["2026-01-01", "2026-02-01"]);
    expect(m.data.get("2026-01-01")).toBeCloseTo(31);
    expect(m.data.get("2026-02-01")).toBeCloseTo(28);
  });

  it("drops months a gap in the weeks only partly covers", () => {
    // Weeks ending Jan 3..Jan 31, then a gap, then Mar 7..Apr 4.
    const pts: Array<[string, number]> = [
      ...saturdays(7).slice(0, 5),
      ["2026-03-07", 7],
      ["2026-03-14", 7],
      ["2026-03-21", 7],
      ["2026-03-28", 7],
      ["2026-04-04", 7],
    ];
    const m = build("week", pts, "TEST@HI.W").aggregate("month", "sum");
    // Feb: no days. Mar: only Mar 1–31 from Mar 7 week back to Mar 1 — the
    // week after the gap fills just its own 7 days, so Mar is complete.
    expect(dates(m)).toEqual(["2026-01-01", "2026-03-01"]);
    expect(m.data.get("2026-03-01")).toBeCloseTo(31);
  });

  it("averages daily-filled values (average)", () => {
    const pts = saturdays(0);
    // Week ending Sat Jan 31 covers Jan 25–31; the next (Feb 7) Feb 1–7.
    for (const p of pts) p[1] = p[0] <= "2026-01-31" ? 10 : 20;
    const m = build("week", pts, "TEST@HI.W").aggregate("month", "average");
    expect(m.data.get("2026-02-01")).toBeCloseTo(20);
  });
});
