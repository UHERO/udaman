/**
 * (Pseudo) variance-covariance builders — port of `CalcQ`, `CalcPowerMatrix`
 * and `CalcQ_Lit` from tempdisagg's td.calc.R.
 */

import type { Matrix, Vector } from "./linalg";
import { fromColumns, zeros } from "./linalg";

/**
 * Chow-Lin AR(1) covariance with σ² factored out:
 * Q[i][j] = ρ^|i−j| / (1 − ρ²).  For ρ = 0 this is the identity (OLS).
 */
export function chowLinQ(rho: number, n: number): Matrix {
  const q = zeros(n, n);
  const scale = 1 / (1 - rho * rho);
  // powers[k] = rho^k, computed incrementally (0^0 = 1 keeps the diagonal).
  const powers = new Array<number>(n);
  powers[0] = 1;
  for (let k = 1; k < n; k++) powers[k] = powers[k - 1] * rho;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) q[i][j] = scale * powers[Math.abs(i - j)];
  }
  return q;
}

/**
 * Apply M⁻¹ = (HD)⁻¹(HD)⁻ᵀ to every column of B without forming M.
 * H and D are unit lower-bidiagonal, so each solve is a two-term recursion;
 * the error is O(cond(HD)·ε) instead of O(cond(HD)²·ε) — this matters at
 * ρ → 1 with long series, where the explicit precision matrix loses ~8
 * digits.
 */
export function littermanSolve(rho: number, b: Matrix): Matrix {
  const n = b.length;
  const cols = n ? b[0].length : 0;
  const out: Vector[] = [];
  for (let j = 0; j < cols; j++) {
    // t = Dᵀ⁻¹ b  (Dᵀ upper bidiagonal: t[i] = b[i] + t[i+1])
    const t = new Array<number>(n);
    for (let i = n - 1; i >= 0; i--)
      t[i] = b[i][j] + (i + 1 < n ? t[i + 1] : 0);
    // s = Hᵀ⁻¹ t  (s[i] = t[i] + ρ·s[i+1])
    const s = new Array<number>(n);
    for (let i = n - 1; i >= 0; i--)
      s[i] = t[i] + (i + 1 < n ? rho * s[i + 1] : 0);
    // r = H⁻¹ s   (r[i] = s[i] + ρ·r[i-1])
    const r = new Array<number>(n);
    for (let i = 0; i < n; i++) r[i] = s[i] + (i > 0 ? rho * r[i - 1] : 0);
    // z = D⁻¹ r   (z[i] = r[i] + z[i-1])
    const z = new Array<number>(n);
    for (let i = 0; i < n; i++) z[i] = r[i] + (i > 0 ? z[i - 1] : 0);
    out.push(z);
  }
  return fromColumns(out);
}
