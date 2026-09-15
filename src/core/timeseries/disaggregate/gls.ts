/**
 * Generalised least squares — port of `CalcGLS` from tempdisagg.
 *
 * R uses Paige's algorithm; we use the mathematically identical whitening
 * form: with W = L Lᵀ, solve the ordinary least-squares problem
 * min ‖L⁻¹y − L⁻¹X β‖² by Householder QR. Both produce the GLS estimator
 * β = (XᵀW⁻¹X)⁻¹XᵀW⁻¹y, generalised RSS, and (XᵀW⁻¹X)⁻¹ = R⁻¹R⁻ᵀ.
 */

import type { Matrix, Vector } from "./linalg";
import {
  backSubstitute,
  cholesky,
  forwardSubstitute,
  forwardSubstituteMatrix,
  identity,
  leastSquares,
  logDetFromCholesky,
  matvec,
} from "./linalg";

export interface GlsResult {
  coefficients: Vector;
  rss: number;
  /** Cholesky factor of the vcov matrix, reused by callers for W⁻¹·u. */
  cholVcov: Matrix;
  logl?: number;
  s2?: number;
  s2Gls?: number;
  se?: Vector;
  tss?: number;
  rank?: number;
  df?: number;
  r2?: number;
  adjR2?: number;
  aic?: number;
  bic?: number;
}

export function calcGls(
  y: Vector,
  x: Matrix,
  vcov: Matrix,
  { logl = true, stats = true }: { logl?: boolean; stats?: boolean } = {},
): GlsResult {
  const m = y.length;
  const n = m ? x[0].length : 0;
  if (m <= n) {
    throw new Error(
      `not enough degrees of freedom: ${m} low-frequency observations for ${n} regressors`,
    );
  }

  const l = cholesky(vcov);
  const xw = forwardSubstituteMatrix(l, x);
  const yw = forwardSubstitute(l, y);
  const ls = leastSquares(xw, yw);

  const z: GlsResult = {
    coefficients: ls.coefficients,
    rss: ls.rss,
    cholVcov: l,
  };

  if (logl) {
    z.s2 = z.rss / m;
    z.logl =
      -m / 2 -
      (m * Math.log(2 * Math.PI)) / 2 -
      (m * Math.log(z.s2)) / 2 -
      logDetFromCholesky(l) / 2;
  }

  if (stats) {
    z.s2Gls = z.rss / (m - n);
    // (XᵀW⁻¹X)⁻¹ = R⁻¹ R⁻ᵀ ; diag = row norms² of R⁻¹
    const eye = identity(n);
    const rInvRows: Vector[] = [];
    for (let j = 0; j < n; j++) rInvRows.push(backSubstitute(ls.r, eye[j]));
    // rInvRows[j] is column j of R⁻¹; diag(R⁻¹R⁻ᵀ)[i] = Σ_j (R⁻¹[i][j])²
    const se = new Array<number>(n).fill(0);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) se[i] += rInvRows[j][i] * rInvRows[j][i];
    }
    z.se = se.map((v) => Math.sqrt(z.s2Gls! * v));

    // generalised TSS around the GLS-weighted mean
    const ew = forwardSubstitute(l, new Array<number>(m).fill(1));
    let ey = 0;
    let ee = 0;
    for (let i = 0; i < m; i++) {
      ey += ew[i] * yw[i];
      ee += ew[i] * ew[i];
    }
    const yBar = ey / ee;
    let tss = 0;
    for (let i = 0; i < m; i++) {
      const d = yw[i] - yBar * ew[i];
      tss += d * d;
    }
    z.tss = tss;
    z.rank = n;
    z.df = m - n;
    z.r2 = 1 - z.rss / tss;
    z.adjR2 = 1 - (z.rss * (m - 1)) / (tss * (m - n));
    z.aic = Math.log(z.rss / m) + 2 * (n / m);
    z.bic = Math.log(z.rss / m) + Math.log(m) * (n / m);
  }
  return z;
}

/** Convenience: fitted = X·β. */
export function fittedValues(x: Matrix, beta: Vector): Vector {
  return matvec(x, beta);
}
