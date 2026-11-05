/**
 * Extract StatCan vectors from the newest `full` and `updates` vintage of
 * each. For each reference period the point with the latest releaseTime
 * wins (the updates on a tie), so the result does not depend on which
 * artifact was fetched last.
 *
 * Values are as published: the scalar factor is not applied (an LFS
 * vector in thousands stays in thousands). A suppressed point (security
 * level 1, "x"), a ".." / "..." status or a null value has no row and,
 * inside the series' range, is a blank missing period.
 *
 * Frequency: WDS's frequencyCode when it is a regular period (D/W/M/Q/S/A);
 * otherwise (v1, population, is 21 "occasional daily" though its points
 * are quarterly) it is read off the dates. A vector whose dates fit no
 * frequency is left out of the extract and named in the stats, like an
 * unknown vector at fetch: its load then fails, the others go on.
 */

import { readFileSync } from "node:fs";

import {
  STATCAN_FREQUENCY,
  STATCAN_SCALAR,
  type WdsPoint,
} from "@catalog/utils/api-clients/statcan";

import type {
  ExtractRow,
  MissingPeriod,
  ParseInput,
  ParseResult,
  ValidationResult,
} from "../../types";
import { vectorKey, type StatcanFile } from "./fetch";

/** statusCode ".." (not available) and "..." (not applicable) */
const NO_VALUE_STATUS = new Set([1, 9]);
const STATUS_SYMBOL: Record<number, string> = {
  2: "0s",
  3: "A",
  4: "B",
  5: "C",
  6: "D",
  7: "E",
  8: "F",
  10: "<LOD",
};

const hasValue = (p: WdsPoint) =>
  typeof p.value === "number" &&
  Number.isFinite(p.value) &&
  (p.securityLevelCode ?? 0) === 0 &&
  !NO_VALUE_STATUS.has(p.statusCode ?? 0);

/** The one-letter frequency of a vector, or null when it fits none. */
export function statcanFrequency(points: readonly WdsPoint[]): string | null {
  const codes = new Map<number, number>();
  for (const p of points) {
    if (p.frequencyCode !== undefined) {
      codes.set(p.frequencyCode, (codes.get(p.frequencyCode) ?? 0) + 1);
    }
  }
  const top = [...codes].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top !== undefined && STATCAN_FREQUENCY[top]) {
    return STATCAN_FREQUENCY[top];
  }
  // irregular code: the dates must be period starts of one frequency
  const dates = points.map((p) => p.refPer);
  if (dates.length === 0) return null;
  if (!dates.every((d) => /^\d{4}-\d{2}-01$/.test(d))) return null;
  const months = new Set(dates.map((d) => Number(d.slice(5, 7))));
  const within = (allowed: number[]) =>
    [...months].every((m) => allowed.includes(m));
  if (within([1])) return "A";
  if (within([1, 7])) return "S";
  if (within([1, 4, 7, 10])) return "Q";
  return "M";
}

type Merged = Map<string, { point: WdsPoint; fromUpdates: boolean }>;

export function parseStatcan(inputs: readonly ParseInput[]): ParseResult {
  const full = new Map<number, StatcanFile>();
  const updates = new Map<number, StatcanFile>();
  for (const input of inputs) {
    const raw = JSON.parse(readFileSync(input.path, "utf8")) as StatcanFile;
    if (
      typeof raw.vectorId !== "number" ||
      !Array.isArray(raw.vectorDataPoint)
    ) {
      throw new Error(
        `${input.artifact.artifactKey}: not a StatCan vector file`,
      );
    }
    const kind = input.artifact.artifactKey.split("/").pop();
    if (kind === "full") full.set(raw.vectorId, raw);
    else if (kind === "updates") updates.set(raw.vectorId, raw);
    else
      throw new Error(`${input.artifact.artifactKey}: unknown artifact kind`);
  }

  const rows: ExtractRow[] = [];
  const missing: MissingPeriod[] = [];
  const checks: ValidationResult[] = [];
  const skipped: string[] = [];
  const statusCounts: Record<string, number> = {};
  const scalars: Record<string, string> = {};
  const mixedScalar: string[] = [];
  let preliminary = 0;

  for (const id of [...new Set([...full.keys(), ...updates.keys()])].sort(
    (a, b) => a - b,
  )) {
    const key = vectorKey(id);
    const base = full.get(id);
    if (!base) {
      throw new Error(`${key}: releases stored without the full history`);
    }
    const merged: Merged = new Map();
    for (const point of base.vectorDataPoint) {
      merged.set(point.refPer, { point, fromUpdates: false });
    }
    for (const point of updates.get(id)?.vectorDataPoint ?? []) {
      const prev = merged.get(point.refPer);
      if (!prev || point.releaseTime >= prev.point.releaseTime) {
        merged.set(point.refPer, { point, fromUpdates: true });
      }
    }
    const points = [...merged.values()]
      .map((m) => m.point)
      .sort((a, b) => a.refPer.localeCompare(b.refPer));

    const freq = statcanFrequency(points);
    if (!freq) {
      skipped.push(`${key}: its dates fit no frequency (A/S/Q/M/W/D)`);
      continue;
    }
    const scalarCodes = new Set(points.map((p) => p.scalarFactorCode ?? 0));
    if (scalarCodes.size > 1) mixedScalar.push(key);
    const scalar = [...scalarCodes][0];
    scalars[key] = STATCAN_SCALAR[scalar] ?? `code ${scalar}`;

    const dims = { series_id: key, frequency: freq };
    const dated = points.filter(hasValue).map((p) => p.refPer);
    const first = dated[0];
    const last = dated[dated.length - 1];
    for (const p of points) {
      if (hasValue(p)) {
        rows.push({ dims, date: p.refPer, value: p.value as number });
        const sym = STATUS_SYMBOL[p.statusCode ?? 0];
        if (sym) statusCounts[sym] = (statusCounts[sym] ?? 0) + 1;
        if (p.symbolCode === 1) preliminary++;
      } else if (first && p.refPer > first && p.refPer < last) {
        missing.push({ dims, date: p.refPer, reason: "blank" });
      }
    }
  }

  checks.push({
    check: "statcan_scalar_factor",
    severity: "hard",
    passed: mixedScalar.length === 0,
    message: mixedScalar.length
      ? `${mixedScalar.length} vector(s) change scalar factor (unit multiplier) mid-series`
      : "every vector has one scalar factor",
    ...(mixedScalar.length ? { details: mixedScalar.slice(0, 20) } : {}),
  });

  return {
    rows,
    missing,
    checks,
    stats: {
      vectors: full.size,
      ...(skipped.length ? { skipped } : {}),
      scalarFactor: scalars,
      preliminaryPoints: preliminary,
      ...(Object.keys(statusCounts).length
        ? { qualityFlags: statusCounts }
        : {}),
    },
  };
}
