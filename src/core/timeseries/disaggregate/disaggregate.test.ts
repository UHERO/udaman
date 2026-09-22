/**
 * API behaviour, the aggregation invariant (#3) for every method ×
 * conversion, and error handling for unsupported inputs.
 */
import { describe, expect, it } from "bun:test";

import {
  aggregate,
  CONVERSIONS,
  disaggregate,
  METHODS,
  UnsupportedMethodError,
} from "./index";
import { cholesky, leastSquares, luSolveVector } from "./linalg";
import { brentFmin } from "./optimize";

/** Deterministic pseudo-random generator (LCG) so tests are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeData(nLow: number, ratio: number, nFore = 0, seed = 1) {
  const r = rng(seed);
  const n = nLow * ratio + nFore;
  const x: number[] = [];
  let level = 100;
  for (let i = 0; i < n; i++) {
    level += 0.5 + 2 * (r() - 0.5);
    x.push(level + 5 * Math.sin((2 * Math.PI * i) / ratio));
  }
  const hf = x.map((v) => 1.5 * v + 20 + 4 * (r() - 0.5));
  const y = aggregate(hf.slice(0, nLow * ratio), { ratio, conversion: "sum" });
  return { x, y };
}

describe("aggregate (ta)", () => {
  const hf = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it("sum", () =>
    expect(aggregate(hf, { ratio: 4, conversion: "sum" })).toEqual([10, 26]));
  it("average", () =>
    expect(aggregate(hf, { ratio: 4, conversion: "average" })).toEqual([
      2.5, 6.5,
    ]));
  it("first", () =>
    expect(aggregate(hf, { ratio: 4, conversion: "first" })).toEqual([1, 5]));
  it("last", () =>
    expect(aggregate(hf, { ratio: 4, conversion: "last" })).toEqual([4, 8]));
  it("drops a trailing incomplete period", () => {
    expect(aggregate(hf, { ratio: 3 })).toEqual([6, 15, 24]);
  });
  it("rejects a non-integer ratio", () => {
    expect(() => aggregate(hf, { ratio: 2.5 })).toThrow(/positive integer/);
  });
  it("rejects an unknown conversion", () => {
    expect(() =>
      aggregate(hf, { ratio: 2, conversion: "median" as never }),
    ).toThrow(/Unsupported conversion "median"/);
  });
});

describe("aggregation invariant for every method × conversion", () => {
  for (const method of METHODS) {
    for (const conversion of CONVERSIONS) {
      it(`${method} / ${conversion} (ratio 4)`, () => {
        const { x, y } = makeData(15, 4, 0, 7);
        const r = disaggregate(y, {
          ratio: 4,
          method,
          conversion,
          indicator: x,
        });
        const back = aggregate(r.values, { ratio: 4, conversion });
        back.forEach((v, i) => {
          expect(Math.abs(v - y[i])).toBeLessThanOrEqual(
            1e-9 * (1 + Math.abs(y[i])),
          );
        });
      });
      it(`${method} / ${conversion} (ratio 3, no indicator)`, () => {
        const { y } = makeData(10, 3, 0, 11);
        const r = disaggregate(y, { ratio: 3, method, conversion });
        const back = aggregate(r.values, { ratio: 3, conversion });
        back.forEach((v, i) => {
          expect(Math.abs(v - y[i])).toBeLessThanOrEqual(
            1e-9 * (1 + Math.abs(y[i])),
          );
        });
      });
    }
  }
});

describe("disaggregate API", () => {
  it("defaults to denton-cholette / sum", () => {
    const { y } = makeData(6, 4);
    const r = disaggregate(y, { ratio: 4 });
    expect(r.method).toBe("denton-cholette");
    expect(r.conversion).toBe("sum");
    expect(r.values.length).toBe(24);
    expect(r.nForecast).toBe(0);
    expect(r.rho).toBeUndefined();
  });

  it("uniform without an indicator spreads evenly", () => {
    const r = disaggregate([40, 80], { ratio: 4, method: "uniform" });
    expect(r.values).toEqual([10, 10, 10, 10, 20, 20, 20, 20]);
    const avg = disaggregate([40, 80], {
      ratio: 4,
      method: "uniform",
      conversion: "average",
    });
    expect(avg.values).toEqual([40, 40, 40, 40, 80, 80, 80, 80]);
  });

  it("forecasts when the indicator is longer than nLow × ratio", () => {
    const { x, y } = makeData(8, 4, 3);
    const r = disaggregate(y, {
      ratio: 4,
      method: "chow-lin-fixed",
      indicator: x,
    });
    expect(r.values.length).toBe(35);
    expect(r.nForecast).toBe(3);
    expect(r.fitted.length).toBe(8);
    expect(r.residuals.length).toBe(8);
  });

  it("accepts multiple indicators as columns for regression methods", () => {
    const a = makeData(10, 4, 0, 3);
    const b = makeData(10, 4, 0, 4);
    const r = disaggregate(a.y, {
      ratio: 4,
      method: "chow-lin-maxlog",
      indicator: [a.x, b.x],
    });
    expect(r.coefficients!.length).toBe(3); // intercept + 2
    expect(r.se!.length).toBe(3);
    expect(r.rho).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.logl!)).toBe(true);
    expect(Number.isFinite(r.aic!)).toBe(true);
    expect(Number.isFinite(r.bic!)).toBe(true);
  });

  it("intercept: false drops the constant", () => {
    const { x, y } = makeData(10, 4);
    const r = disaggregate(y, {
      ratio: 4,
      method: "ols",
      indicator: x,
      intercept: false,
    });
    expect(r.coefficients!.length).toBe(1);
  });

  it("truncates negative rho to truncatedRho for maxlog", () => {
    // A white-noise indicator against an AR(-) target: force a negative ML ρ
    // by constructing y_l from an alternating hf series.
    const n = 40;
    const hf = Array.from({ length: n }, (_, i) => 100 + (i % 2 ? 30 : -30));
    const y = aggregate(hf, { ratio: 4 });
    const x = Array.from(
      { length: n },
      (_, i) => 100 + (i % 2 ? 25 : -25) + (i % 3),
    );
    const free = disaggregate(y, {
      ratio: 4,
      method: "chow-lin-maxlog",
      indicator: x,
      truncatedRho: -1,
    });
    const trunc = disaggregate(y, {
      ratio: 4,
      method: "chow-lin-maxlog",
      indicator: x,
    });
    if (free.rho! < 0) {
      expect(trunc.rho).toBe(0);
      expect(trunc.truncated).toBe(true);
    } else {
      expect(trunc.truncated).toBe(false);
    }
  });

  it("fernandez equals litterman-fixed with rho 0; ols equals chow-lin-fixed with rho 0", () => {
    const { x, y } = makeData(12, 3);
    const f = disaggregate(y, { ratio: 3, method: "fernandez", indicator: x });
    const l = disaggregate(y, {
      ratio: 3,
      method: "litterman-fixed",
      indicator: x,
      fixedRho: 0,
    });
    f.values.forEach((v, i) => expect(v).toBeCloseTo(l.values[i], 9));
    const o = disaggregate(y, { ratio: 3, method: "ols", indicator: x });
    const c = disaggregate(y, {
      ratio: 3,
      method: "chow-lin-fixed",
      indicator: x,
      fixedRho: 0,
    });
    o.values.forEach((v, i) => expect(v).toBeCloseTo(c.values[i], 9));
  });
});

describe("errors", () => {
  const { x, y } = makeData(6, 4);

  it("names the supported set for unsupported methods", () => {
    for (const m of [
      "chow-lin-minrss-ecotrim",
      "chow-lin-minrss-quilis",
      "dynamic-maxlog",
      "dynamic-minrss",
      "dynamic-fixed",
      "litterman-minrss",
      "fast",
      "bogus",
    ]) {
      expect(() =>
        disaggregate(y, { ratio: 4, method: m as never, indicator: x }),
      ).toThrow(UnsupportedMethodError);
      expect(() =>
        disaggregate(y, { ratio: 4, method: m as never, indicator: x }),
      ).toThrow(new RegExp(`"${m}".*supported methods: ${METHODS.join(", ")}`));
    }
  });

  it("rejects non-integer or missing ratio", () => {
    expect(() => disaggregate(y, { ratio: 4.5 })).toThrow(/positive integer/);
    expect(() => disaggregate(y, { ratio: 0 })).toThrow(/positive integer/);
    expect(() => disaggregate(y, {} as never)).toThrow(/positive integer/);
  });

  it("rejects unknown conversions", () => {
    expect(() =>
      disaggregate(y, { ratio: 4, conversion: "mean" as never }),
    ).toThrow(/Unsupported conversion/);
  });

  it("rejects a short indicator", () => {
    expect(() =>
      disaggregate(y, { ratio: 4, indicator: x.slice(0, 20) }),
    ).toThrow(/too short/);
  });

  it("rejects multiple indicators for Denton", () => {
    expect(() =>
      disaggregate(y, { ratio: 4, method: "denton", indicator: [x, x] }),
    ).toThrow(/exactly one indicator/);
  });

  it("rejects bad Denton parameters", () => {
    expect(() => disaggregate(y, { ratio: 4, method: "denton", h: 4 })).toThrow(
      /h must be/,
    );
    expect(() =>
      disaggregate(y, {
        ratio: 4,
        method: "denton",
        criterion: "multiplicative" as never,
      }),
    ).toThrow(/criterion/);
  });

  it("rejects regression with neither indicator nor intercept", () => {
    expect(() =>
      disaggregate(y, { ratio: 4, method: "ols", intercept: false }),
    ).toThrow(/indicator and\/or intercept/);
  });

  it("rejects non-finite input", () => {
    expect(() => disaggregate([1, NaN, 3], { ratio: 4 })).toThrow(/non-finite/);
    expect(() =>
      disaggregate(y, {
        ratio: 4,
        indicator: x.map((v, i) => (i === 2 ? Infinity : v)),
      }),
    ).toThrow(/non-finite/);
  });

  it("requires enough degrees of freedom for regression", () => {
    expect(() =>
      disaggregate([1, 2], {
        ratio: 4,
        method: "ols",
        indicator: [x.slice(0, 8), x.slice(8, 16)],
      }),
    ).toThrow(/degrees of freedom/);
  });
});

describe("linalg / optimize primitives", () => {
  it("cholesky rejects non-PD matrices", () => {
    expect(() =>
      cholesky([
        [1, 2],
        [2, 1],
      ]),
    ).toThrow(/positive definite/);
  });
  it("luSolve solves an indefinite system", () => {
    const a = [
      [0, 1, 2],
      [1, 0, 3],
      [4, -3, 8],
    ];
    const xSol = luSolveVector(a, [8, 11, 14]);
    // A·x = b ?
    a.forEach((row, i) => {
      const s = row.reduce((acc, v, j) => acc + v * xSol[j], 0);
      expect(s).toBeCloseTo([8, 11, 14][i], 10);
    });
  });
  it("leastSquares recovers exact coefficients", () => {
    const xs = [1, 2, 3, 4, 5];
    const a = xs.map((v) => [1, v]);
    const b = xs.map((v) => 3 + 2 * v);
    const r = leastSquares(a, b);
    expect(r.coefficients[0]).toBeCloseTo(3, 12);
    expect(r.coefficients[1]).toBeCloseTo(2, 12);
    expect(r.rss).toBeLessThan(1e-20);
  });
  it("brentFmin finds a quadratic minimum to R's tolerance", () => {
    const xmin = brentFmin(
      (v) => (v - 0.3) * (v - 0.3) + 1,
      -0.999,
      0.999,
      1e-16,
    );
    expect(Math.abs(xmin - 0.3)).toBeLessThan(1e-7);
  });
});
