import { describe, expect, test } from "bun:test";

import Loader from "./loader";

describe("Loader.lagDays", () => {
  test("monthly measures from the month end, not the stored first day", () => {
    // September stored as 2026-09-01; month ends 09-30
    expect(Loader.lagDays("2026-09-01", "month", "2026-10-23")).toBe(23);
  });

  test("quarterly measures from the quarter end", () => {
    // Q2 stored as 2026-04-01; quarter ends 06-30
    expect(Loader.lagDays("2026-04-01", "quarter", "2026-07-15")).toBe(15);
  });

  test("annual measures from Dec 31", () => {
    expect(Loader.lagDays("2025-01-01", "year", "2026-01-31")).toBe(31);
  });

  test("weekly dates are already the ending Saturday", () => {
    expect(Loader.lagDays("2026-10-17", "week", "2026-10-23")).toBe(6);
  });

  test("daily measures from the date itself", () => {
    expect(Loader.lagDays("2026-10-01", "day", "2026-10-23")).toBe(22);
  });

  test("accepts frequency codes", () => {
    expect(Loader.lagDays("2026-09-01", "M", "2026-10-23")).toBe(23);
  });

  test("current period and future-dated data count as 0", () => {
    expect(Loader.lagDays("2026-10-01", "month", "2026-10-23")).toBe(0);
    expect(Loader.lagDays("2027-01-01", "quarter", "2026-10-23")).toBe(0);
  });

  test("unknown frequency falls back to the raw date", () => {
    expect(Loader.lagDays("2026-10-01", null, "2026-10-23")).toBe(22);
  });
});

describe("Loader.suggestLagLimit", () => {
  // monthly, published ~45 days after month end
  const monthly = [
    { date: "2026-01-01", arrival: "2026-03-17 03:00:00" },
    { date: "2026-02-01", arrival: "2026-04-14 03:00:00" },
    { date: "2026-03-01", arrival: "2026-05-15 03:00:00" },
    { date: "2026-04-01", arrival: "2026-06-16 03:00:00" },
    { date: "2026-05-01", arrival: "2026-07-14 03:00:00" },
  ];

  test("worst pre-release lag plus mean arrival gap", () => {
    // peaks: 04-14 vs 01-31 = 73, 05-15 vs 02-28 = 76, 06-16 vs 03-31 = 77,
    // 07-14 vs 04-30 = 75 → 77; mean gap (03-17 → 07-14) / 4 = 29.75
    expect(Loader.suggestLagLimit(monthly, "month")).toBe(107);
  });

  test("older points widen the window, up to 10", () => {
    // Dec 2025 data landed late (2026-03-01): peak 03-17 vs 12-31 = 76 is
    // under Mar's 77, but the gap (03-01 → 03-17 = 16) pulls the mean down
    const older = [{ date: "2025-12-01", arrival: "2026-03-01 03:00:00" }];
    // mean gap (03-01 → 07-14) / 5 = 26.8 → 77 + 26.8
    expect(Loader.suggestLagLimit([...older, ...monthly], "month")).toBe(104);
    expect(Loader.suggestLagLimit([...older, ...monthly], "month", 5)).toBe(
      107,
    );
  });

  test("never looks back more than 10 points", () => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const y = 2025 + Math.floor((i + 6) / 12);
      const m = ((i + 6) % 12) + 1;
      const pad = (n: number) => String(n).padStart(2, "0");
      // published on the 15th of the following month
      const ay = m === 12 ? y + 1 : y;
      const am = m === 12 ? 1 : m + 1;
      return {
        date: `${y}-${pad(m)}-01`,
        arrival: `${ay}-${pad(am)}-15 03:00:00`,
      };
    });
    // a huge early delay outside the 10-point window is ignored
    months[0].arrival = "2025-01-01 00:00:00";
    const limit = Loader.suggestLagLimit(months, "month");
    expect(limit).toBeGreaterThan(40);
    expect(limit).toBeLessThan(80);
  });

  test("null with fewer than 5 points", () => {
    expect(Loader.suggestLagLimit(monthly.slice(1), "month")).toBeNull();
  });

  test("null when points arrived together (bulk reload)", () => {
    const bulk = monthly.map((p) => ({ ...p, arrival: "2026-07-14 03:00:00" }));
    expect(Loader.suggestLagLimit(bulk, "month")).toBeNull();
  });

  test("a bulk reload ends the run; the separate arrivals after it count", () => {
    const bulk = [
      { date: "2025-10-01", arrival: "2026-03-01 03:00:00" },
      { date: "2025-11-01", arrival: "2026-03-01 03:00:00" },
      { date: "2025-12-01", arrival: "2026-03-01 03:00:00" },
    ];
    // run = Dec (bulk tail) + the 5 monthly points
    expect(Loader.suggestLagLimit([...bulk, ...monthly], "month")).toBe(104);
  });

  test("daily feed gets a few days of slack", () => {
    const daily = [1, 2, 3, 4, 5].map((d) => ({
      date: `2026-10-0${d}`,
      arrival: `2026-10-0${d + 2} 06:00:00`,
    }));
    // peaks 3 days, gap 1 day
    expect(Loader.suggestLagLimit(daily, "day")).toBe(4);
  });
});
