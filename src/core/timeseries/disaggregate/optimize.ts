/**
 * One-dimensional bounded minimisation — a direct port of R's `Brent_fmin`
 * (src/library/stats/src/optimize.c), which backs `stats::optimize()`.
 *
 * tempdisagg calls `optimize(Objective, lower = -0.999, upper = 0.999,
 * tol = 1e-16)`. Reproducing the exact iteration sequence (golden section +
 * parabolic interpolation with the same guards) is what lets the estimated ρ
 * agree with R to floating-point noise rather than to the nominal tolerance.
 */
export function brentFmin(
  f: (x: number) => number,
  ax: number,
  bx: number,
  tol: number,
): number {
  const c = (3 - Math.sqrt(5)) * 0.5;
  let eps = Number.EPSILON;
  let tol1 = eps + 1;
  eps = Math.sqrt(eps);

  let a = ax;
  let b = bx;
  let v = a + c * (b - a);
  let w = v;
  let x = v;
  let d = 0;
  let e = 0;
  let fx = f(x);
  let fv = fx;
  let fw = fx;
  const tol3 = tol / 3;

  for (;;) {
    const xm = (a + b) * 0.5;
    tol1 = eps * Math.abs(x) + tol3;
    const t2 = tol1 * 2;
    if (Math.abs(x - xm) <= t2 - (b - a) * 0.5) break;

    let p = 0;
    let q = 0;
    let r = 0;
    if (Math.abs(e) > tol1) {
      // fit parabola
      r = (x - w) * (fx - fv);
      q = (x - v) * (fx - fw);
      p = (x - v) * q - (x - w) * r;
      q = (q - r) * 2;
      if (q > 0) p = -p;
      else q = -q;
      r = e;
      e = d;
    }

    let u: number;
    if (
      Math.abs(p) >= Math.abs(q * 0.5 * r) ||
      p <= q * (a - x) ||
      p >= q * (b - x)
    ) {
      // golden-section step
      e = x < xm ? b - x : a - x;
      d = c * e;
    } else {
      // parabolic-interpolation step
      d = p / q;
      u = x + d;
      if (u - a < t2 || b - u < t2) {
        d = tol1;
        if (x >= xm) d = -d;
      }
    }

    if (Math.abs(d) >= tol1) u = x + d;
    else if (d > 0) u = x + tol1;
    else u = x - tol1;

    const fu = f(u);
    if (fu <= fx) {
      if (u < x) b = x;
      else a = x;
      v = w;
      w = x;
      x = u;
      fv = fw;
      fw = fx;
      fx = fu;
    } else {
      if (u < x) a = u;
      else b = u;
      if (fu <= fw || w === x) {
        v = w;
        fv = fw;
        w = u;
        fw = fu;
      } else if (fu <= fv || v === x || v === w) {
        v = u;
        fv = fu;
      }
    }
  }
  return x;
}
