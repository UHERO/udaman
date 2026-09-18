/**
 * Regression-based methods — port of `SubRegressionBased` from tempdisagg
 * (td.sub.R), restricted to the supported set:
 *
 *   chow-lin-maxlog / chow-lin-fixed   AR(1) residuals, ρ by ML or fixed
 *   litterman-maxlog / litterman-fixed random walk with AR(1) innovations
 *   fernandez                          Litterman with ρ = 0
 *   ols                                Chow-Lin with ρ = 0
 */

import type { Conversion } from "./conversion";
import { conversionMatrix } from "./conversion";
import { chowLinQ, littermanSolve } from "./covariance";
import { calcGls } from "./gls";
import type { Matrix, Vector } from "./linalg";
import { choleskySolveVector, matmul, matvec, transpose } from "./linalg";
import { brentFmin } from "./optimize";
import type { RegressionMethod } from "./types";

export interface RegressionInput {
  yLow: Vector;
  /** High-frequency design matrix, (nLow·ratio + nFore) × k. */
  x: Matrix;
  ratio: number;
  nFore: number;
  conversion: Conversion;
  method: RegressionMethod;
  truncatedRho: number;
  fixedRho: number;
  /** Optimiser settings (R defaults). */
  tol?: number;
  lower?: number;
  upper?: number;
}

export interface RegressionOutput {
  values: Vector;
  fitted: Vector;
  preliminary: Vector;
  residuals: Vector;
  rho: number;
  truncated: boolean;
  coefficients: Vector;
  se: Vector;
  rss: number;
  tss: number;
  logl: number;
  aic: number;
  bic: number;
  r2: number;
  adjR2: number;
  s2: number;
  s2Gls: number;
  rank: number;
  df: number;
}

const LITTERMAN_FAMILY = new Set<RegressionMethod>([
  "fernandez",
  "litterman-maxlog",
  "litterman-fixed",
]);

export function subRegressionBased(input: RegressionInput): RegressionOutput {
  const {
    yLow,
    x,
    ratio,
    nFore,
    conversion,
    method,
    truncatedRho,
    fixedRho,
    tol = 1e-16,
    lower = -0.999,
    upper = 0.999,
  } = input;

  const nLow = yLow.length;
  const n = x.length;
  const c = conversionMatrix(nLow, conversion, ratio, 0, nFore);
  const cT = transpose(c);
  const xLow = matmul(c, x);

  /**
   * For a given ρ return Z = Q Cᵀ (n × nLow) and the aggregated covariance
   * C Q Cᵀ (nLow × nLow), without ever forming Q⁻¹ or inverting anything.
   */
  const aggregatedCov = (rho: number): { z: Matrix; vLow: Matrix } => {
    let z: Matrix;
    if (LITTERMAN_FAMILY.has(method)) {
      z = littermanSolve(rho, cT); // M⁻¹ Cᵀ via bidiagonal solves
    } else {
      z = matmul(chowLinQ(rho, n), cT);
    }
    return { z, vLow: matmul(c, z) };
  };

  let rho: number;
  let truncated = false;
  if (method === "chow-lin-maxlog" || method === "litterman-maxlog") {
    const objective = (r: number): number =>
      -calcGls(yLow, xLow, aggregatedCov(r).vLow, { stats: false }).logl!;
    rho = brentFmin(objective, lower, upper, tol);
    if (rho < truncatedRho) {
      rho = truncatedRho;
      truncated = true;
    }
  } else if (method === "fernandez" || method === "ols") {
    rho = 0;
  } else {
    rho = fixedRho;
  }

  const { z, vLow } = aggregatedCov(rho);
  const gls = calcGls(yLow, xLow, vLow);

  // preliminary series p = X β
  const p = matvec(x, gls.coefficients);
  const cp = matvec(c, p);
  const uLow = yLow.map((v, i) => v - cp[i]);
  // y = p + Q Cᵀ (C Q Cᵀ)⁻¹ u_l
  const w = choleskySolveVector(gls.cholVcov, uLow);
  const zw = matvec(z, w);
  const values = p.map((v, i) => v + zw[i]);

  return {
    values,
    fitted: cp,
    preliminary: p,
    residuals: uLow,
    rho,
    truncated,
    coefficients: gls.coefficients,
    se: gls.se!,
    rss: gls.rss,
    tss: gls.tss!,
    logl: gls.logl!,
    aic: gls.aic!,
    bic: gls.bic!,
    r2: gls.r2!,
    adjR2: gls.adjR2!,
    s2: gls.s2!,
    s2Gls: gls.s2Gls!,
    rank: gls.rank!,
    df: gls.df!,
  };
}
