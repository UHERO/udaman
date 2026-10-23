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
