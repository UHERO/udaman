/**
 * Denton family — port of `SubDenton` from tempdisagg (td.sub.R).
 *
 *   denton           Denton (1971): y = X + Q Cᵀ (C Q Cᵀ)⁻¹ (y_l − C X),
 *                    Q = (D₀ᵀ D₀)⁻¹
 *   denton-cholette  Cholette (1984) / Cholette & Dagum (2006) eq. 6.8:
 *                    drop the first h rows of D₀ (removes the spurious
 *                    transient at the start) and solve the KKT system
 *   uniform          denton with h = 0, additive
 */

import type { Conversion } from "./conversion";
import { conversionMatrix } from "./conversion";
import type { Matrix, Vector } from "./linalg";
import {
  cholesky,
  choleskySolveVector,
  fromColumns,
  identity,
  luSolveVector,
  matmul,
  matvec,
  transpose,
  zeros,
} from "./linalg";
import type { DentonCriterion, DentonMethod } from "./types";

export interface DentonInput {
  yLow: Vector;
  /** Single high-frequency indicator, length nLow·ratio + nFore. */
  x: Vector;
  ratio: number;
  nFore: number;
  conversion: Conversion;
  method: DentonMethod;
  criterion: DentonCriterion;
  h: number;
}

export interface DentonOutput {
  values: Vector;
  fitted: Vector;
  preliminary: Vector;
  residuals: Vector;
  criterion: DentonCriterion;
  h: number;
}

/** First-difference matrix D (unit lower bidiagonal with −1). */
function differenceMatrix(n: number): Matrix {
  const d = identity(n);
  for (let i = 1; i < n; i++) d[i][i - 1] = -1;
  return d;
}

/**
 * Apply Q = (D₀ᵀD₀)⁻¹ = D₀⁻¹ D₀⁻ᵀ to each column of B, where
 * D₀ = Dʰ · diag(scale). D⁻¹ is a cumulative sum and D⁻ᵀ a reverse
 * cumulative sum, so no matrix is ever formed or factored.
 */
function applyDentonQ(b: Matrix, h: number, scale: Vector | null): Matrix {
  const n = b.length;
  const cols = n ? b[0].length : 0;
  const out: Vector[] = [];
  for (let j = 0; j < cols; j++) {
    const v = b.map((row) => row[j]);
    // D₀⁻ᵀ = (Dᵀ)⁻ʰ · diag(1/scale): scale first, then h reverse cumsums
    if (scale) for (let i = 0; i < n; i++) v[i] /= scale[i];
    for (let k = 0; k < h; k++) {
      for (let i = n - 2; i >= 0; i--) v[i] += v[i + 1];
    }
    // D₀⁻¹ = diag(1/scale) · D⁻ʰ: h cumsums, then scale
    for (let k = 0; k < h; k++) {
      for (let i = 1; i < n; i++) v[i] += v[i - 1];
    }
    if (scale) for (let i = 0; i < n; i++) v[i] /= scale[i];
    out.push(v);
  }
  return fromColumns(out);
}

export function subDenton(input: DentonInput): DentonOutput {
  let { method, criterion, h } = input;
  const { yLow, x, ratio, nFore, conversion } = input;

  if (!["additive", "proportional"].includes(criterion)) {
    throw new Error(
      `criterion for Denton methods must be "additive" or "proportional"; got "${criterion}"`,
    );
  }
  if (!Number.isInteger(h) || h < 0 || h > 3) {
    throw new Error(`h must be an integer in 0..3; got ${h}`);
  }

  // uniform is a special case of denton
  if (method === "uniform") {
    h = 0;
    criterion = "additive";
    method = "denton";
  }

  const nLow = yLow.length;
  const n = x.length;
  const c = conversionMatrix(nLow, conversion, ratio, 0, nFore);

  const d = differenceMatrix(n);
  let d0: Matrix = identity(n);
  for (let i = 0; i < h; i++) d0 = matmul(d, d0);

  // Proportional criterion: D₀ ← D₀ · diag(mean(X) / X). Keep the diagonal
  // scaling separately so the original-Denton path can apply D₀⁻¹ exactly.
  let scale: Vector | null = null;
  if (criterion === "proportional") {
    let mean = 0;
    for (const v of x) mean += v;
    mean /= n;
    scale = x.map((v) => mean / v);
    for (const row of d0) {
      for (let j = 0; j < n; j++) row[j] *= scale[j];
    }
  }

  // low-frequency residuals u_l = y_l − C X
  const cx = matvec(c, x);
  const uLow = yLow.map((v, i) => v - cx[i]);

  let values: Vector;
  if (method === "denton-cholette") {
    const d1 = h === 0 ? d0 : d0.slice(h);
    const a = matmul(transpose(d1), d1);
    // KKT system:  [A Cᵀ; C 0] [y; λ] = [A X; y_l]
    const size = n + nLow;
    const k = zeros(size, size);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) k[i][j] = a[i][j];
      for (let j = 0; j < nLow; j++) k[i][n + j] = c[j][i];
    }
    for (let i = 0; i < nLow; i++) {
      for (let j = 0; j < n; j++) k[n + i][j] = c[i][j];
    }
    const ax = matvec(a, x);
    const rhs = [...ax, ...yLow];
    values = luSolveVector(k, rhs).slice(0, n);
  } else {
    // denton: Q = (D₀ᵀD₀)⁻¹, distribution D = Q Cᵀ (C Q Cᵀ)⁻¹.
    // Q Cᵀ is applied as D₀⁻¹ D₀⁻ᵀ Cᵀ through h cumulative sums each way
    // rather than by factoring D₀ᵀD₀, whose condition number is cond(D₀)².
    const z = applyDentonQ(transpose(c), h, scale); // Q Cᵀ  (n × nLow)
    const vLow = matmul(c, z); // C Q Cᵀ
    const w = choleskySolveVector(cholesky(vLow), uLow);
    const zw = matvec(z, w);
    values = x.map((v, i) => v + zw[i]);
  }

  return {
    values,
    fitted: cx,
    preliminary: x.slice(),
    residuals: uLow,
    criterion,
    h,
  };
}
