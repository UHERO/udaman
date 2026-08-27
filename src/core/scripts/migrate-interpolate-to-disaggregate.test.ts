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
