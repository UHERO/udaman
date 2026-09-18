/**
 * Test #2: agreement with the R reference implementation on a generated
 * corpus (fixtures/r-fixtures.json, produced by fixtures/generate-fixtures.R
 * at the pinned upstream commit — see README).
 *
 * Tolerances (relative to the magnitude of each vector):
 *  - closed-form paths (Denton family, fixed-ρ, Fernández, OLS): 1e-10
 *  - original `denton` with h = 3: 1e-6. D₀ = D³ has cond ≈ n³; upstream
 *    inverts D₀ᵀD₀ (cond ≈ n⁶), we apply D₀⁻¹D₀⁻ᵀ via cumulative sums. The
 *    two disagree at ~1e-7; evaluating Denton's own objective ‖D₀(y−X)‖² at
 *    both solutions is a wash (each wins a few cases, most tie), i.e. both
 *    are at the noise floor for that problem. `denton-cholette` (the
 *    recommended variant) holds 1e-10 at every h.
 *  - Litterman family at |ρ| ≥ 0.99 with long series: 1e-6. R forms and
 *    inverts the precision matrix (DᵀHᵀHD)⁻¹ explicitly, whose condition
 *    number is cond(HD)² ≈ 1e9 there; we apply the inverse through the
 *    bidiagonal factors (error ∝ cond(HD)). The two disagree at ~1e-8;
 *    both satisfy the aggregation identity to 1e-12, which holds by
 *    construction and so cannot arbitrate between them.
 *  - `*-maxlog`: ρ comes from a 1-D optimiser (R's Brent_fmin, ported
 *    step-for-step). Near the optimum the log-likelihood is flat to
 *    rounding level, so a last-bit difference in the GLS arithmetic (R uses
 *    Paige's algorithm on LAPACK; we whiten + Householder) changes the step
 *    sequence and ρ agrees only to ~1e-7. With `first`/`last` conversions
 *    and ratio 4 the likelihood is an even function of ρ, so ±ρ are exactly
 *    tied optima and R and JS may pick opposite signs. The meaningful check
 *    is therefore on the objective: the JS optimum must be at least as good
 *    as R's (never worse by more than 1e-9). When ρ agrees to 1e-6 the
 *    values and statistics are additionally compared at 1e-5 (a 1e-7 shift
 *    in ρ moves the Litterman coefficients by up to ~2e-6).
 */
import { describe, expect, it } from "bun:test";

import type { Conversion } from "./conversion";
import fixtures from "./fixtures/r-fixtures.json";
import { aggregate, disaggregate } from "./index";
import type { DentonCriterion, Method } from "./types";

interface Case {
  method: Method;
  conversion: Conversion;
  ratio: number;
  h?: number;
  criterion?: DentonCriterion;
  fixedRho?: number;
  truncatedRho?: number;
  intercept?: boolean;
  y: number[];
  indicator?: number[][];
  expected: {
    values: number[];
    fitted: number[];
    residuals: number[];
    preliminary: number[];
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
  };
}

/** jsonlite auto-unboxes length-1 vectors; restore them to arrays. */
const arr = (v: unknown): number[] =>
  Array.isArray(v) ? (v as number[]) : [v as number];
const cases = (fixtures as { cases: Case[] }).cases.map((c) => ({
  ...c,
  y: arr(c.y),
  indicator: c.indicator ? c.indicator.map(arr) : undefined,
  expected: {
    ...c.expected,
    values: arr(c.expected.values),
    fitted: arr(c.expected.fitted),
    residuals: arr(c.expected.residuals),
    preliminary: arr(c.expected.preliminary),
    coefficients:
      c.expected.coefficients != null
        ? arr(c.expected.coefficients)
        : undefined,
    se: c.expected.se != null ? arr(c.expected.se) : undefined,
  },
}));

function expectClose(
  actual: number,
  expected: number,
  rel: number,
  label: string,
) {
  const tol = rel * (1 + Math.abs(expected));
  const diff = Math.abs(actual - expected);
  if (!(diff <= tol)) {
    throw new Error(
      `${label}: got ${actual}, expected ${expected} (|diff|=${diff} > ${tol})`,
    );
  }
}

/** Vector comparison with tolerance relative to the vector's magnitude. */
function expectVecClose(
  actual: number[],
  expected: number[],
  rel: number,
  label: string,
) {
  expect(actual.length).toBe(expected.length);
  let scale = 1;
  for (const v of expected) scale = Math.max(scale, Math.abs(v));
  for (let i = 0; i < expected.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (!(diff <= rel * scale)) {
      throw new Error(
        `${label}[${i}]: got ${actual[i]}, expected ${expected[i]} (|diff|=${diff} > ${rel * scale})`,
      );
    }
  }
}

const byMethod = new Map<Method, Case[]>();
for (const c of cases) {
  const list = byMethod.get(c.method) ?? [];
  list.push(c);
  byMethod.set(c.method, list);
}

describe("R fixtures (tempdisagg numeric mode)", () => {
  it("corpus is large enough", () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
  });

  for (const [method, list] of byMethod) {
    describe(method, () => {
      list.forEach((c, idx) => {
        const label =
          `${c.conversion} r=${c.ratio} n=${c.y.length}` +
          (c.h != null ? ` h=${c.h} ${c.criterion}` : "") +
          (c.fixedRho != null
            ? ` rho=${c.fixedRho} trunc=${c.truncatedRho}`
            : "") +
          (c.indicator ? ` k=${c.indicator.length}` : " noind") +
          (c.intercept ? " +int" : "") +
          ` #${idx}`;
        it(label, () => {
          const r = disaggregate(c.y, {
            ratio: c.ratio,
            method: c.method,
            conversion: c.conversion,
            indicator: c.indicator,
            intercept: c.intercept ?? true,
            fixedRho: c.fixedRho,
            truncatedRho: c.truncatedRho,
            h: c.h,
            criterion: c.criterion,
          });
          const e = c.expected;
          const isMaxlog = method.endsWith("maxlog");
          let rel = 1e-10;
          if (method === "denton" && c.h === 3) rel = 1e-6;
          if (
            method.startsWith("litterman") &&
            Math.abs(c.fixedRho ?? 0) >= 0.99
          )
            rel = 1e-6;
          if (isMaxlog) {
            // Evaluate the (negative) log-likelihood at both optima with the
            // fixed-ρ variant of the same model.
            const fixedMethod = method.replace("maxlog", "fixed") as Method;
            const objective = (rho: number) =>
              -disaggregate(c.y, {
                ratio: c.ratio,
                method: fixedMethod,
                conversion: c.conversion,
                indicator: c.indicator,
                intercept: c.intercept ?? true,
                fixedRho: rho,
                checkInvariant: false,
              }).logl!;
            const objMine = objective(r.rho!);
            const objR = objective(e.rho!);
            if (!(objMine <= objR + 1e-9 * (1 + Math.abs(objR)))) {
              throw new Error(
                `maxlog optimum worse than R's: -logl(${r.rho})=${objMine} vs -logl(${e.rho})=${objR}`,
              );
            }
            if (Math.abs(r.rho! - e.rho!) > 1e-6) {
              // Different (tied or better) optimum: values are not comparable.
              const agg = aggregate(r.values, {
                ratio: c.ratio,
                conversion: c.conversion,
              });
              expectVecClose(
                agg.slice(0, c.y.length),
                c.y,
                1e-9,
                "aggregate(values)",
              );
              return;
            }
            rel = 1e-5;
          }
          expectVecClose(r.values, e.values, rel, "values");
          expectVecClose(r.fitted, e.fitted, rel, "fitted");
          expectVecClose(r.residuals, e.residuals, rel, "residuals");
          expectVecClose(r.preliminary, e.preliminary, rel, "preliminary");
          if (e.rho != null) {
            expectClose(r.rho!, e.rho, rel, "rho");
            expect(r.truncated).toBe(e.truncated);
            expectVecClose(
              r.coefficients!,
              e.coefficients!,
              rel,
              "coefficients",
            );
            expectVecClose(r.se!, e.se!, rel, "se");
            expectClose(r.rss!, e.rss!, rel, "rss");
            expectClose(r.tss!, e.tss!, rel, "tss");
            expectClose(r.logl!, e.logl!, rel, "logl");
            expectClose(r.aic!, e.aic!, rel, "aic");
            expectClose(r.bic!, e.bic!, rel, "bic");
            expectClose(r.r2!, e.r2!, rel, "r2");
            expectClose(r.adjR2!, e.adjR2!, rel, "adjR2");
          }
          // Invariant #3, on the R reference values too.
          const agg = aggregate(r.values, {
            ratio: c.ratio,
            conversion: c.conversion,
          });
          // 1e-9 rather than machine precision: Denton h=3 stacks three
          // difference operators and the KKT system is ill-conditioned; R's own
          // values violate the identity at ~6e-10 there.
          // A forecast tail can complete extra periods; compare the nLow we own.
          expectVecClose(
            agg.slice(0, c.y.length),
            c.y,
            1e-9,
            "aggregate(values)",
          );
        });
      });
    });
  }
});
