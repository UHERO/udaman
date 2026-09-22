/**
 * Conversion matrix C and temporal aggregation (port of `CalcC` and the
 * numeric core of `ta()` / `SubAggregation` from tempdisagg).
 *
 * No dates here: the caller owns the time axis. Series are plain arrays in
 * chronological order.
 */

import type { Matrix, Vector } from "./linalg";
import { zeros } from "./linalg";

export type Conversion = "sum" | "average" | "first" | "last";

export const CONVERSIONS: readonly Conversion[] = [
  "sum",
  "average",
  "first",
  "last",
];

export function assertConversion(c: string): asserts c is Conversion {
  if (!CONVERSIONS.includes(c as Conversion)) {
    throw new Error(
      `Unsupported conversion "${c}". Supported: ${CONVERSIONS.join(", ")}.`,
    );
  }
}

export function assertRatio(ratio: unknown): asserts ratio is number {
  if (typeof ratio !== "number" || !Number.isInteger(ratio) || ratio < 1) {
    throw new Error(
      `ratio must be a positive integer (e.g. 4 for annual→quarterly, 3 for quarterly→monthly); got ${String(ratio)}`,
    );
  }
}

/** Weights that map one low-frequency period onto its `ratio` hf periods. */
export function conversionWeights(
  conversion: Conversion,
  ratio: number,
): Vector {
  const w = new Array<number>(ratio).fill(0);
  switch (conversion) {
    case "sum":
      w.fill(1);
      break;
    case "average":
      w.fill(1 / ratio);
      break;
    case "first":
      w[0] = 1;
      break;
    case "last":
      w[ratio - 1] = 1;
      break;
  }
  return w;
}

/**
 * Conversion matrix C (nLow × (nBack + nLow·ratio + nFore)).
 * C = I_{nLow} ⊗ wᵀ, padded with zero columns for back/forecast periods.
 */
export function conversionMatrix(
  nLow: number,
  conversion: Conversion,
  ratio: number,
  nBack = 0,
  nFore = 0,
): Matrix {
  if (nBack < 0 || nFore < 0) throw new Error("nBack/nFore must be >= 0");
  const w = conversionWeights(conversion, ratio);
  const c = zeros(nLow, nBack + nLow * ratio + nFore);
  for (let i = 0; i < nLow; i++) {
    const base = nBack + i * ratio;
    for (let k = 0; k < ratio; k++) c[i][base + k] = w[k];
  }
  return c;
}

export interface AggregateOptions {
  /** Integer number of high-frequency periods per low-frequency period. */
  ratio: number;
  conversion?: Conversion;
}

/**
 * Temporal aggregation (`ta()`): collapse each complete block of `ratio`
 * high-frequency values into one low-frequency value. A trailing incomplete
 * block is dropped, matching tempdisagg (which only emits complete periods).
 * The series is assumed to start at the beginning of a low-frequency period.
 */
export function aggregate(
  highFreq: readonly number[],
  { ratio, conversion = "sum" }: AggregateOptions,
): number[] {
  assertRatio(ratio);
  assertConversion(conversion);
  const nLow = Math.floor(highFreq.length / ratio);
  const out = new Array<number>(nLow);
  for (let i = 0; i < nLow; i++) {
    const base = i * ratio;
    switch (conversion) {
      case "sum": {
        let s = 0;
        for (let k = 0; k < ratio; k++) s += highFreq[base + k];
        out[i] = s;
        break;
      }
      case "average": {
        let s = 0;
        for (let k = 0; k < ratio; k++) s += highFreq[base + k];
        out[i] = s / ratio;
        break;
      }
      case "first":
        out[i] = highFreq[base];
        break;
      case "last":
        out[i] = highFreq[base + ratio - 1];
        break;
    }
  }
  return out;
}
