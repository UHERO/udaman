import type { Conversion } from "./conversion";

export const DENTON_METHODS = ["denton", "denton-cholette", "uniform"] as const;
export const REGRESSION_METHODS = [
  "chow-lin-maxlog",
  "chow-lin-fixed",
  "litterman-maxlog",
  "litterman-fixed",
  "fernandez",
  "ols",
] as const;
export const METHODS = [...DENTON_METHODS, ...REGRESSION_METHODS] as const;

export type DentonMethod = (typeof DENTON_METHODS)[number];
export type RegressionMethod = (typeof REGRESSION_METHODS)[number];
export type Method = (typeof METHODS)[number];

export type DentonCriterion = "additive" | "proportional";

export interface DisaggregateOptions {
  /** Integer number of high-frequency periods per low-frequency period. */
  ratio: number;
  method?: Method;
  conversion?: Conversion;
  /**
   * High-frequency indicator(s), chronological. A single `number[]`, or an
   * array of columns (`number[][]`, one inner array per indicator). Must be
   * at least `lowFreq.length * ratio` long; any surplus tail is treated as
   * forecast periods (`n.fc` in tempdisagg). Denton methods accept exactly
   * one indicator.
   */
  indicator?: readonly number[] | readonly (readonly number[])[];
  /**
   * Regression methods only: add an intercept column (R's default `y ~ x`).
   * Set `false` for `y ~ 0 + x`. Ignored by Denton methods.
   */
  intercept?: boolean;
  /** `*-fixed` methods: the AR(1) parameter to use. Default 0.5 (R default). */
  fixedRho?: number;
  /** `*-maxlog` methods: floor for the estimated ρ. Default 0. */
  truncatedRho?: number;
  /** Denton: order of differencing, 0–3. Default 1. */
  h?: number;
  /** Denton: `additive` or `proportional`. Default `proportional`. */
  criterion?: DentonCriterion;
  /**
   * After solving, verify `aggregate(values) ≈ lowFreq` and throw if the
   * identity fails. Default `true` — this is the correctness invariant of
   * every method and is cheap to check.
   */
  checkInvariant?: boolean;
}

export interface DisaggregateResult {
  /** Final high-frequency series (interpolated and, if applicable, extrapolated). */
  values: number[];
  /** Low-frequency fitted values, C·p. */
  fitted: number[];
  /** Preliminary high-frequency series p (= X for Denton, X·β for regression). */
  preliminary: number[];
  /** Low-frequency residuals, lowFreq − fitted. */
  residuals: number[];
  method: Method;
  conversion: Conversion;
  ratio: number;
  /** Number of forecast periods appended past the last low-frequency period. */
  nForecast: number;

  // ── Denton only ──
  criterion?: DentonCriterion;
  h?: number;

  // ── Regression only ──
  rho?: number;
  truncated?: boolean;
  coefficients?: number[];
  se?: number[];
  rss?: number;
  tss?: number;
  logl?: number;
  aic?: number;
  bic?: number;
  r2?: number;
  adjR2?: number;
  /** ML variance estimate rss / n_l. */
  s2?: number;
  /** GLS variance estimate rss / (n_l − k). */
  s2Gls?: number;
  rank?: number;
  df?: number;
}
