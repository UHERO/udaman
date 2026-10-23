import { describe, expect, test } from "bun:test";

import { formatLoaderLagMessage } from "./loader-lag-mailer";

describe("formatLoaderLagMessage", () => {
  test("lists loaders most-behind first, no-data loaders on top", () => {
    const text = formatLoaderLagMessage([
      {
        loaderId: 1,
        seriesId: 10,
        seriesName: "E_NF@HI.M",
        universe: "UHERO",
        maxLagDays: 45,
        lastDate: "2026-08-01",
        lagDays: 54,
      },
      {
        loaderId: 2,
        seriesId: 20,
        seriesName: "VISNS@HI.D",
        universe: "UHERO",
        maxLagDays: 15,
        lastDate: null,
        lagDays: null,
      },
      {
        loaderId: 3,
        seriesId: 30,
        seriesName: "VAP@HI.D",
        universe: "UHERO",
        maxLagDays: 15,
        lastDate: "2026-09-01",
        lagDays: 52,
      },
    ]);
    const lines = text.split("\n");
    expect(lines[0]).toBe("*3 loaders past lag limit*");
    expect(lines[1]).toContain("VISNS@HI.D> loader #2: no data points");
    expect(lines[2]).toContain(
      "/uhero/series/10|E_NF@HI.M> loader #1: last 2026-08-01, 54d behind (limit 45d)",
    );
    expect(lines[3]).toContain("loader #3");
  });

  test("singular heading for one loader", () => {
    const text = formatLoaderLagMessage([
      {
        loaderId: 1,
        seriesId: 10,
        seriesName: "E_NF@HI.M",
        universe: "UHERO",
        maxLagDays: 45,
        lastDate: "2026-08-01",
        lagDays: 54,
      },
    ]);
    expect(text.split("\n")[0]).toBe("*1 loader past lag limit*");
  });
});
