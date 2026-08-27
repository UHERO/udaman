/**
 * Minimal dense linear algebra for the temporal disaggregation port.
 *
 * Zero dependencies. Matrices are `number[][]` in row-major form and are
 * small (a few hundred rows at most), so clarity beats cleverness here.
 *
 * Numerical policy (see README):
 *  - never form an explicit inverse; always solve against a right-hand side
 *  - SPD systems go through Cholesky, indefinite systems (the Denton-Cholette
 *    KKT matrix) through LU with partial pivoting
 *  - log-determinants come from the Cholesky diagonal, never from `det()`
 */

export type Matrix = number[][];
export type Vector = number[];

export function zeros(rows: number, cols: number): Matrix {
  const m: Matrix = new Array(rows);
  for (let i = 0; i < rows; i++) m[i] = new Array<number>(cols).fill(0);
  return m;
}

export function identity(n: number): Matrix {
  const m = zeros(n, n);
  for (let i = 0; i < n; i++) m[i][i] = 1;
  return m;
}

export function transpose(a: Matrix): Matrix {
  const rows = a.length;
  const cols = rows ? a[0].length : 0;
  const t = zeros(cols, rows);
  for (let i = 0; i < rows; i++) {
    const ai = a[i];
    for (let j = 0; j < cols; j++) t[j][i] = ai[j];
  }
  return t;
}

export function matmul(a: Matrix, b: Matrix): Matrix {
  const n = a.length;
  const k = b.length;
  const p = k ? b[0].length : 0;
  if (n && a[0].length !== k) {
    throw new Error(
      `matmul: dimension mismatch (${n}x${a[0].length}) * (${k}x${p})`,
    );
  }
  const c = zeros(n, p);
  for (let i = 0; i < n; i++) {
    const ai = a[i];
    const ci = c[i];
    for (let l = 0; l < k; l++) {
      const ail = ai[l];
      if (ail === 0) continue;
      const bl = b[l];
      for (let j = 0; j < p; j++) ci[j] += ail * bl[j];
    }
  }
  return c;
}

export function matvec(a: Matrix, x: Vector): Vector {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    let s = 0;
    for (let j = 0; j < ai.length; j++) s += ai[j] * x[j];
    out[i] = s;
  }
  return out;
}

export function dot(x: Vector, y: Vector): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * y[i];
  return s;
}

export function columnOf(a: Matrix, j: number): Vector {
  return a.map((row) => row[j]);
}

export function fromColumns(cols: Vector[]): Matrix {
  const rows = cols.length ? cols[0].length : 0;
  const m = zeros(rows, cols.length);
  for (let j = 0; j < cols.length; j++) {
    if (cols[j].length !== rows) {
      throw new Error("fromColumns: all columns must have the same length");
    }
    for (let i = 0; i < rows; i++) m[i][j] = cols[j][i];
  }
  return m;
}

// ─── Cholesky ────────────────────────────────────────────────────────

/**
 * Cholesky factor L (lower triangular) of a symmetric positive-definite
 * matrix, A = L Lᵀ. Throws when A is not (numerically) positive definite.
 */
export function cholesky(a: Matrix): Matrix {
  const n = a.length;
  const l = zeros(n, n);
  for (let j = 0; j < n; j++) {
    let d = a[j][j];
    const lj = l[j];
    for (let k = 0; k < j; k++) d -= lj[k] * lj[k];
    if (!(d > 0)) {
      throw new Error(
        `cholesky: matrix is not positive definite (pivot ${d} at ${j})`,
      );
    }
    const ljj = Math.sqrt(d);
    lj[j] = ljj;
    for (let i = j + 1; i < n; i++) {
      const li = l[i];
      let s = a[i][j];
      for (let k = 0; k < j; k++) s -= li[k] * lj[k];
      li[j] = s / ljj;
    }
  }
  return l;
}

/** Solve L x = b for lower-triangular L (forward substitution). */
export function forwardSubstitute(l: Matrix, b: Vector): Vector {
  const n = l.length;
  const x = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const li = l[i];
    let s = b[i];
    for (let k = 0; k < i; k++) s -= li[k] * x[k];
    x[i] = s / li[i];
  }
  return x;
}

/** Solve Lᵀ x = b for lower-triangular L (back substitution on Lᵀ). */
export function backSubstituteTransposed(l: Matrix, b: Vector): Vector {
  const n = l.length;
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let k = i + 1; k < n; k++) s -= l[k][i] * x[k];
    x[i] = s / l[i][i];
  }
  return x;
}

/** Solve R x = b for upper-triangular R (back substitution). */
export function backSubstitute(r: Matrix, b: Vector): Vector {
  const n = r.length;
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    const ri = r[i];
    let s = b[i];
    for (let k = i + 1; k < n; k++) s -= ri[k] * x[k];
    x[i] = s / ri[i];
  }
  return x;
}

/** Solve A x = b given the Cholesky factor L of A. */
export function choleskySolveVector(l: Matrix, b: Vector): Vector {
  return backSubstituteTransposed(l, forwardSubstitute(l, b));
}

/** Solve A X = B (column by column) given the Cholesky factor L of A. */
export function choleskySolveMatrix(l: Matrix, b: Matrix): Matrix {
  const cols = b.length ? b[0].length : 0;
  const out: Vector[] = [];
  for (let j = 0; j < cols; j++) {
    out.push(choleskySolveVector(l, columnOf(b, j)));
  }
  return fromColumns(out);
}

/** Apply L⁻¹ to every column of B (whitening): returns L⁻¹ B. */
export function forwardSubstituteMatrix(l: Matrix, b: Matrix): Matrix {
  const cols = b.length ? b[0].length : 0;
  const out: Vector[] = [];
  for (let j = 0; j < cols; j++) out.push(forwardSubstitute(l, columnOf(b, j)));
  return fromColumns(out);
}

/** log|A| for SPD A from its Cholesky factor: 2·Σ log(diag L). */
export function logDetFromCholesky(l: Matrix): number {
  let s = 0;
  for (let i = 0; i < l.length; i++) s += Math.log(l[i][i]);
  return 2 * s;
}

// ─── LU with partial pivoting ────────────────────────────────────────

/**
 * Solve the general (possibly indefinite) square system A X = B for a matrix
 * right-hand side, using LU with partial pivoting. A and B are not modified.
 */
export function luSolveMatrix(aIn: Matrix, bIn: Matrix): Matrix {
  const n = aIn.length;
  const p = bIn.length ? bIn[0].length : 0;
  const a = aIn.map((r) => r.slice());
  const b = bIn.map((r) => r.slice());

  for (let k = 0; k < n; k++) {
    // pivot
    let piv = k;
    let max = Math.abs(a[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(a[i][k]);
      if (v > max) {
        max = v;
        piv = i;
      }
    }
    if (max === 0) throw new Error(`luSolve: singular matrix at column ${k}`);
    if (piv !== k) {
      [a[k], a[piv]] = [a[piv], a[k]];
      [b[k], b[piv]] = [b[piv], b[k]];
    }
    const ak = a[k];
    const bk = b[k];
    const akk = ak[k];
    for (let i = k + 1; i < n; i++) {
      const ai = a[i];
      const f = ai[k] / akk;
      if (f === 0) continue;
      ai[k] = f;
      for (let j = k + 1; j < n; j++) ai[j] -= f * ak[j];
      const bi = b[i];
      for (let j = 0; j < p; j++) bi[j] -= f * bk[j];
    }
  }
  // back substitution
  const x = zeros(n, p);
  for (let j = 0; j < p; j++) {
    for (let i = n - 1; i >= 0; i--) {
      const ai = a[i];
      let s = b[i][j];
      for (let k = i + 1; k < n; k++) s -= ai[k] * x[k][j];
      x[i][j] = s / ai[i];
    }
  }
  return x;
}

export function luSolveVector(a: Matrix, b: Vector): Vector {
  return columnOf(luSolveMatrix(a, fromColumns([b])), 0);
}

// ─── Householder QR least squares ────────────────────────────────────

export interface LeastSquaresResult {
  /** Coefficient vector (length = number of columns of A). */
  coefficients: Vector;
  /** Upper-triangular R factor (p × p) from the QR decomposition of A. */
  r: Matrix;
  /** Residual sum of squares ‖b − A·coef‖². */
  rss: number;
}

/**
 * Solve min ‖A x − b‖₂ via Householder QR. A must have full column rank and
 * at least as many rows as columns.
 */
export function leastSquares(aIn: Matrix, bIn: Vector): LeastSquaresResult {
  const m = aIn.length;
  const p = m ? aIn[0].length : 0;
  if (m < p) throw new Error("leastSquares: fewer rows than columns");
  const a = aIn.map((r) => r.slice());
  const b = bIn.slice();

  for (let k = 0; k < p; k++) {
    // Householder vector for column k, rows k..m-1
    let norm = 0;
    for (let i = k; i < m; i++) norm += a[i][k] * a[i][k];
    norm = Math.sqrt(norm);
    if (norm === 0)
      throw new Error(`leastSquares: rank deficient at column ${k}`);
    const alpha = a[k][k] > 0 ? -norm : norm;
    const v = new Array<number>(m).fill(0);
    v[k] = a[k][k] - alpha;
    for (let i = k + 1; i < m; i++) v[i] = a[i][k];
    let vnorm2 = 0;
    for (let i = k; i < m; i++) vnorm2 += v[i] * v[i];
    if (vnorm2 === 0) continue;
    // apply H = I - 2 v vᵀ / (vᵀv) to remaining columns and to b
    for (let j = k; j < p; j++) {
      let s = 0;
      for (let i = k; i < m; i++) s += v[i] * a[i][j];
      const f = (2 * s) / vnorm2;
      for (let i = k; i < m; i++) a[i][j] -= f * v[i];
    }
    let sb = 0;
    for (let i = k; i < m; i++) sb += v[i] * b[i];
    const fb = (2 * sb) / vnorm2;
    for (let i = k; i < m; i++) b[i] -= fb * v[i];
  }

  const r = zeros(p, p);
  for (let i = 0; i < p; i++) for (let j = i; j < p; j++) r[i][j] = a[i][j];
  const coefficients = backSubstitute(r, b.slice(0, p));
  let rss = 0;
  for (let i = p; i < m; i++) rss += b[i] * b[i];
  return { coefficients, r, rss };
}
