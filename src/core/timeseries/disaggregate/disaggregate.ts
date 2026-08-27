/**
 * Public entry point: temporal disaggregation of a low-frequency series to
 * a higher frequency with an integer ratio. Plain arrays in and out; the
 * caller owns the date axis.
 */

import type { Conversion } from "./conversion";
import { aggregate, assertConversion, assertRatio } from "./conversion";
import { subDenton } from "./denton";
import type { Matrix, Vector } from "./linalg";
import { fromColumns } from "./linalg";
import { subRegressionBased } from "./regression";
import type {
  DentonMethod,
  DisaggregateOptions,
  DisaggregateResult,
  Method,
  RegressionMethod,
} from "./types";
import { DENTON_METHODS, METHODS, REGRESSION_METHODS } from "./types";

export class UnsupportedMethodError extends Error {
  constructor(method: string) {
    super(
      `Unsupported disaggregation method "${method}". This is a partial port of ` +
        `tempdisagg; supported methods: ${METHODS.join(", ")}.`,
    );
    this.name = "UnsupportedMethodError";
  }
}

export function assertMethod(method: string): asserts method is Method {
  if (!METHODS.includes(method as Method))
    throw new UnsupportedMethodError(method);
}

function isDenton(m: Method): m is DentonMethod {
  return (DENTON_METHODS as readonly string[]).includes(m);
}
function isRegression(m: Method): m is RegressionMethod {
  return (REGRESSION_METHODS as readonly string[]).includes(m);
}

function assertFinite(name: string, v: readonly number[]): void {
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== "number" || !Number.isFinite(v[i])) {
      throw new Error(
        `${name} contains a non-finite value at index ${i}: ${v[i]}`,
      );
    }
  }
}

/** Normalise `indicator` into a list of columns. */
function indicatorColumns(
  ind: DisaggregateOptions["indicator"],
): Vector[] | null {
  if (ind == null) return null;
  if (ind.length === 0) throw new Error("indicator must not be empty");
  if (Array.isArray(ind[0])) {
    const cols = (ind as readonly (readonly number[])[]).map((c) => [...c]);
    const len = cols[0].length;
    cols.forEach((col, j) => {
      if (col.length !== len) {
        throw new Error(
          `indicator column ${j} has length ${col.length}, expected ${len}`,
        );
      }
      assertFinite(`indicator[${j}]`, col);
    });
    return cols;
  }
  const col = [...(ind as readonly number[])];
  assertFinite("indicator", col);
  return [col];
}

/**
 * Verify the aggregation identity `aggregate(values) ≈ lowFreq`. Tolerance
 * is relative to the magnitude of the series; a failure means the linear
 * solve broke down (e.g. a near-singular indicator), not a rounding wobble.
 */
export function checkAggregationInvariant(
  lowFreq: readonly number[],
  values: readonly number[],
  ratio: number,
  conversion: Conversion,
  relTol = 1e-8,
): void {
  const agg = aggregate(values, { ratio, conversion });
  let scale = 0;
  for (const v of lowFreq) scale = Math.max(scale, Math.abs(v));
  const tol = relTol * (1 + scale);
  for (let i = 0; i < lowFreq.length; i++) {
    const diff = Math.abs(agg[i] - lowFreq[i]);
    if (!(diff <= tol)) {
      throw new Error(
        `aggregation invariant violated at low-frequency index ${i}: ` +
          `aggregate(values)=${agg[i]} vs input=${lowFreq[i]} (|diff|=${diff}, tol=${tol})`,
      );
    }
  }
}

export function disaggregate(
  lowFreq: readonly number[],
  options: DisaggregateOptions,
): DisaggregateResult {
  const {
    ratio,
    method = "denton-cholette",
    conversion = "sum",
    intercept = true,
    fixedRho = 0.5,
    truncatedRho = 0,
    h = 1,
    criterion = "proportional",
    checkInvariant = true,
  } = options;

  assertRatio(ratio);
  assertMethod(method);
  assertConversion(conversion);
  if (!Array.isArray(lowFreq) || lowFreq.length === 0) {
    throw new Error("lowFreq must be a non-empty array");
  }
  assertFinite("lowFreq", lowFreq);

  const yLow = [...lowFreq];
  const nLow = yLow.length;
  const minN = nLow * ratio;
  const cols = indicatorColumns(options.indicator);

  let n: number;
  if (cols) {
    n = cols[0].length;
    if (n < minN) {
      throw new Error(
        `indicator is too short: ${n} high-frequency values, need at least ${minN} (${nLow} × ${ratio})`,
      );
    }
  } else {
    n = minN;
  }
  const nFore = n - minN;

  let out: DisaggregateResult;

  if (isDenton(method)) {
    if (cols && cols.length > 1) {
      throw new Error(
        "Denton methods accept exactly one indicator (right-hand side must be a vector)",
      );
    }
    const x = cols ? cols[0] : new Array<number>(n).fill(1);
    const r = subDenton({
      yLow,
      x,
      ratio,
      nFore,
      conversion,
      method,
      criterion,
      h,
    });
    out = {
      values: r.values,
      fitted: r.fitted,
      preliminary: r.preliminary,
      residuals: r.residuals,
      method,
      conversion,
      ratio,
      nForecast: nFore,
      criterion: r.criterion,
      h: r.h,
    };
  } else if (isRegression(method)) {
    const designCols: Vector[] = [];
    if (intercept) designCols.push(new Array<number>(n).fill(1));
    if (cols) designCols.push(...cols);
    if (designCols.length === 0) {
      throw new Error(
        "regression methods need an indicator and/or intercept: true",
      );
    }
    const x: Matrix = fromColumns(designCols);
    const r = subRegressionBased({
      yLow,
      x,
      ratio,
      nFore,
      conversion,
      method,
      truncatedRho,
      fixedRho,
    });
    out = {
      values: r.values,
      fitted: r.fitted,
      preliminary: r.preliminary,
      residuals: r.residuals,
      method,
      conversion,
      ratio,
      nForecast: nFore,
      rho: r.rho,
      truncated: r.truncated,
      coefficients: r.coefficients,
      se: r.se,
      rss: r.rss,
      tss: r.tss,
      logl: r.logl,
      aic: r.aic,
      bic: r.bic,
      r2: r.r2,
      adjR2: r.adjR2,
      s2: r.s2,
      s2Gls: r.s2Gls,
      rank: r.rank,
      df: r.df,
    };
  } else {
    throw new UnsupportedMethodError(method);
  }

  if (checkInvariant) {
    checkAggregationInvariant(yLow, out.values, ratio, conversion);
  }
  return out;
}
