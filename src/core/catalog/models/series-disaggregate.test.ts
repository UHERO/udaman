import { describe, expect, it } from "bun:test";

import Series from "./series";

function build(
  frequency: string,
  points: Array<[string, number]>,
  name = "T@HI.A",
): Series {
  const s = new Series({ name });
  s.frequency = frequency;
  s.data = new Map(points);
  return s;
}

describe("Series.disaggregate", () => {
  const annual = build("year", [
    ["2020-01-01", 400],
    ["2021-01-01", 440],
    ["2022-01-01", 480],
  ]);

  it("year → quarter with uniform and no indicator dates the output correctly", () => {
    const q = annual.disaggregate("quarter", {
      method: "uniform",
      conversion: "sum",
    });
    expect(q.frequency).toBe("quarter");
    expect([...q.data.keys()]).toEqual([
      "2020-01-01",
      "2020-04-01",
      "2020-07-01",
      "2020-10-01",
      "2021-01-01",
      "2021-04-01",
      "2021-07-01",
      "2021-10-01",
      "2022-01-01",
      "2022-04-01",
      "2022-07-01",
      "2022-10-01",
    ]);
    expect(q.data.get("2020-01-01")).toBe(100);
    expect(q.data.get("2022-10-01")).toBe(120);
  });

  it("round-trips through Series.aggregate", () => {
    const m = annual.disaggregate("month", {
      method: "denton-cholette",
      conversion: "average",
    });
    expect(m.data.size).toBe(36);
    const back = m.aggregate("year", "average");
    for (const [d, v] of annual.data)
      expect(back.data.get(d)).toBeCloseTo(v, 8);
  });

  it("uses a quarterly indicator and forecasts its surplus periods", () => {
    const ind = build(
      "quarter",
      Array.from({ length: 14 }, (_, i) => {
        const y = 2020 + Math.floor(i / 4);
        const m = (i % 4) * 3 + 1;
        return [
          `${y}-${String(m).padStart(2, "0")}-01`,
          100 + i * 2 + (i % 4),
        ] as [string, number];
      }),
      "IND@HI.Q",
    );
    const {
      series,
      results: [result],
    } = annual.disaggregateDetailed("quarter", {
      method: "chow-lin-maxlog",
      conversion: "sum",
      indicator: ind,
    });
    expect(result.nForecast).toBe(2);
    expect(series.data.size).toBe(14);
    expect(series.data.has("2023-04-01")).toBe(true);
    expect(result.rho).toBeDefined();
    expect(result.coefficients!.length).toBe(2);
    const back = series.aggregate("year", "sum");
    for (const [d, v] of annual.data)
      expect(back.data.get(d)).toBeCloseTo(v, 8);
  });

  it("splits on gaps by default and leaves the hole in the output", () => {
    const gappy = build("semi", [
      ["2018-01-01", 10],
      ["2018-07-01", 12],
      ["2019-01-01", 14],
      // 2019-07-01 missing
      ["2020-01-01", 20],
      ["2020-07-01", 22],
    ]);
    const { series: q, results } = gappy.disaggregateDetailed("quarter");
    expect(results.length).toBe(2);
    expect([...q.data.keys()].sort()).toEqual([
      "2018-01-01",
      "2018-04-01",
      "2018-07-01",
      "2018-10-01",
      "2019-01-01",
      "2019-04-01",
      "2020-01-01",
      "2020-04-01",
      "2020-07-01",
      "2020-10-01",
    ]);
    expect(q.data.has("2019-07-01")).toBe(false);
    // each run still reconciles to its own source values
    const back = q.aggregate("semi", "average");
    for (const [d, v] of gappy.data) expect(back.data.get(d)).toBeCloseTo(v, 8);
    // a single-point run is spread uniformly
    const single = build("year", [
      ["2020-01-01", 8],
      ["2022-01-01", 12],
      ["2023-01-01", 16],
    ]);
    const r = single.disaggregateDetailed("quarter", { conversion: "sum" });
    expect(r.results[0].method).toBe("uniform");
    expect(r.series.data.get("2020-04-01")).toBe(2);
    expect(r.results[1].method).toBe("denton-cholette");
  });

  it("rejects gaps, lower targets, mismatched indicators", () => {
    const gappy = build("year", [
      ["2020-01-01", 1],
      ["2022-01-01", 3],
    ]);
    expect(() => gappy.disaggregate("quarter", { gaps: "error" })).toThrow(
      /not contiguous/,
    );
    const gapInd = build(
      "quarter",
      [
        ["2020-01-01", 1],
        ["2020-04-01", 1],
      ],
      "I@HI.Q",
    );
    expect(() => gappy.disaggregate("quarter", { indicator: gapInd })).toThrow(
      /not contiguous/,
    );
    expect(() => annual.disaggregate("year")).toThrow(/higher frequency/);
    const monthly = build("month", [["2020-01-01", 1]], "M@HI.M");
    expect(() =>
      annual.disaggregate("quarter", { indicator: monthly }),
    ).toThrow(/must match the target/);
    const late = build(
      "quarter",
      [
        ["2020-04-01", 1],
        ["2020-07-01", 1],
      ],
      "Q@HI.Q",
    );
    expect(() => annual.disaggregate("quarter", { indicator: late })).toThrow(
      /same period/,
    );
    expect(() =>
      annual.disaggregate("quarter", { method: "dynamic-maxlog" as never }),
    ).toThrow(/Unsupported disaggregation method/);
  });
});
