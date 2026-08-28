import { describe, expect, it } from "bun:test";

import { rewriteEval } from "./migrate-interpolate-to-disaggregate";

describe("rewriteEval", () => {
  it("maps the four supported shapes", () => {
    expect(rewriteEval('"A@HI.A".ts.interpolate(:quarter)')).toBe(
      '"A@HI.A".ts.disaggregate(:quarter)',
    );
    expect(rewriteEval('"A@HI.A".ts.interpolate(:quarter, :average)')).toBe(
      '"A@HI.A".ts.disaggregate(:quarter)',
    );
    expect(rewriteEval('"A@HI.A".ts.interpolate(:quarter, :sum)')).toBe(
      '"A@HI.A".ts.disaggregate(:quarter, :sum)',
    );
    expect(rewriteEval('"A@HI.A".ts.interpolate(:month)')).toBe(
      '"A@HI.A".ts.disaggregate(:month)',
    );
    expect(rewriteEval('"A@HI.A".ts.census_interpolate(:quarter)')).toBe(
      '"A@HI.A".ts.disaggregate(:quarter)',
    );
  });
  it("keeps surrounding chain intact", () => {
    expect(
      rewriteEval('"PCMD@HON.S".ts.interpolate(:quarter).trim("1987-01-01")'),
    ).toBe('"PCMD@HON.S".ts.disaggregate(:quarter).trim("1987-01-01")');
  });
  it("folds a divide-by-ratio into a sum conversion", () => {
    expect(
      rewriteEval('("NBIR@HI.A".ts / 4).census_interpolate(:quarter)'),
    ).toBe('"NBIR@HI.A".ts.disaggregate(:quarter, :sum)');
    expect(
      rewriteEval('("X@HI.A".ts / 12).interpolate(:month, :average)'),
    ).toBe('"X@HI.A".ts.disaggregate(:month, :sum)');
    expect(rewriteEval('("X@HI.Q".ts / 3).interpolate(:month)')).toBe(
      '"X@HI.Q".ts.disaggregate(:month, :sum)',
    );
    expect(
      rewriteEval(
        '("X@HI.A".ts / 4).census_interpolate(:quarter).trim("1990-01-01")',
      ),
    ).toBe('"X@HI.A".ts.disaggregate(:quarter, :sum).trim("1990-01-01")');
  });
  it("does not fold a divisor that isn't the frequency ratio", () => {
    // Only the inner call is renamed; the script flags these for hand review.
    expect(rewriteEval('("X@HI.A".ts / 3).census_interpolate(:quarter)')).toBe(
      '("X@HI.A".ts / 3).disaggregate(:quarter)',
    );
    expect(rewriteEval('("X@HI.A".ts / 4).interpolate(:quarter, :sum)')).toBe(
      '("X@HI.A".ts / 4).disaggregate(:quarter, :sum)',
    );
  });
  it("leaves other interpolate-family methods alone", () => {
    for (const e of [
      '"A@HI.A".ts.linear_interpolate(:quarter)',
      '"A@HI.A".ts.fill_interpolate_to(:month)',
      '"A@HI.A".ts.trms_interpolate_to_quarterly',
      '"A@HI.M".ts.fill_missing_months_linear',
    ])
      expect(rewriteEval(e)).toBe(e);
  });
});
