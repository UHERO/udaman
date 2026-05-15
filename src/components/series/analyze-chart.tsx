"use client";

import { useCallback, useMemo } from "react";
import { formatLevel } from "@catalog/utils/format";
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type BarMode = "yoy" | "ytd" | "levelChange" | "pop";

export const BAR_LABELS: Record<BarMode, string> = {
  yoy: "YOY %",
  ytd: "YTD %",
  levelChange: "LVL Chg",
  pop: "PoP %",
};

export const SERIES_COLORS = [
  // UHERO brand palette
  "var(--color-ublue)",
  "var(--color-uorange)",
  "var(--color-ugreen)",
  "var(--color-upurple)",
  "var(--color-uteal)",
  "var(--color-ucyan)",
  "var(--color-ugray)",
  // Extended fallbacks
  "#e11d48",
  "#6366f1",
  "#d946ef",
];

export interface ChartRow {
  date: string;
  level: number | null;
  levelChange: number | null;
  yoy: number | null;
  ytd: number | null;
  pop: number | null;
  cagr: number | null;
  // Overlay fields (populated on demand by computeOverlays)
  linearTrend?: number | null;
  logLinearTrend?: number | null;
  hpTrend?: number | null;
  rollingMean?: number | null;
  rollingStdUpper?: number | null;
  rollingStdLower?: number | null;
  rollingStdBand?: number | null;
  // Second-axis transformation (populated when secondAxis mode is active)
  transformedLevel?: number | null;
  // Main transformation stored separately so the table can show original level + transform column
  mainTransformed?: number | null;
  // Dynamic series columns for multi-series compare mode (series_0, series_1, ...)
  [key: `series_${number}`]: number | null | undefined;
  // Transformed series columns for compare mode table (transformed_0, transformed_1, ...)
  [key: `transformed_${number}`]: number | null | undefined;
}

export type Overlay =
  | "rollingMean"
  | "linearTrend"
  | "logLinearTrend"
  | "hpTrend"
  | "mean"
  | "stdDev"
  | "rollingStdDev";

export type TimelineEventForChart = {
  id: number;
  start: string;
  end: string;
  name: string;
  eventType: string;
  description?: string | null;
  /** Original start date (YYYY-MM-DD) for edit forms — `start` may be snapped */
  startDate?: string;
  /** Original end date (YYYY-MM-DD) for edit forms */
  endDate?: string | null;
};

export type Transformation =
  | "zScore"
  | "deviationFromTrend"
  | "logLevel"
  | "indexToYear"
  | "rollingMean"
  | "linearTrend"
  | "logLinearTrend"
  | "hpTrend"
  | "yoy"
  | "ytd"
  | "pop"
  | "levelChange"
  | "cagr";

export const formatDate = (d: string) => d;

/* ------------------------------------------------------------------ */
/*  X-axis date formatting                                             */
/* ------------------------------------------------------------------ */

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Auto-detect frequency from date spacing when freq code isn't available */
function detectFrequency(dates: string[]): string {
  if (dates.length < 2) return "M";
  const d1 = new Date(dates[0]);
  const d2 = new Date(dates[1]);
  const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 300) return "A";
  if (diffDays > 80) return "Q";
  if (diffDays > 20) return "M";
  if (diffDays > 5) return "W";
  return "D";
}

/** Select which dates get axis ticks — aims for ~12–15 labels */
function computeAxisTicks(dates: string[], freqCode: string): string[] {
  if (dates.length === 0) return [];
  const max = 15;

  if (freqCode === "A") {
    if (dates.length <= max) return dates;
    const step = Math.ceil(dates.length / max);
    return dates.filter((_, i) => i % step === 0);
  }

  if (freqCode === "Q" || freqCode === "S") {
    // Show all quarters if few enough
    if (dates.length <= max) return dates;
    // Otherwise show Q1 of each year
    const q1 = dates.filter((d) => d.slice(5, 7) === "01");
    if (q1.length <= max) return q1;
    const step = Math.ceil(q1.length / max);
    return q1.filter((_, i) => i % step === 0);
  }

  // Monthly / Weekly / Daily — try quarterly, semi-annual, then annual tick spacing
  const quarterly = dates.filter((d) => {
    const m = d.slice(5, 7);
    return m === "01" || m === "04" || m === "07" || m === "10";
  });
  if (quarterly.length <= max) return quarterly;

  const biannual = dates.filter((d) => {
    const m = d.slice(5, 7);
    return m === "01" || m === "07";
  });
  if (biannual.length <= max) return biannual;

  const annual = dates.filter((d) => d.slice(5, 7) === "01");
  if (annual.length <= max) return annual;

  const step = Math.ceil(annual.length / max);
  return annual.filter((_, i) => i % step === 0);
}

/**
 * Build a tick formatter that shows compact dates.
 * Pre-computes which ticks are first-of-year so the formatter is pure.
 */
function makeAxisTickFormatter(
  freqCode: string,
  ticks: string[],
): (dateStr: string) => string {
  // Pre-compute which ticks start a new year
  const isFirstOfYear = new Set<string>();
  let prevYear = "";
  for (const t of ticks) {
    const y = t.slice(0, 4);
    if (y !== prevYear) {
      isFirstOfYear.add(t);
      prevYear = y;
    }
  }

  return (dateStr: string): string => {
    if (!dateStr || dateStr.length < 7) return dateStr;
    const year = dateStr.slice(0, 4);
    const month = parseInt(dateStr.slice(5, 7), 10);
    const showYear = isFirstOfYear.has(dateStr);

    if (freqCode === "A") return year;

    if (freqCode === "Q" || freqCode === "S") {
      const q = `Q${Math.ceil(month / 3)}`;
      return showYear ? `${year} ${q}` : q;
    }

    // Monthly / Weekly / Daily
    const mon = SHORT_MONTHS[month - 1] ?? "";
    return showYear ? `${mon} '${year.slice(2)}` : mon;
  };
}

export const formatValue = (v: number, decimals: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(decimals);
};

/* ------------------------------------------------------------------ */
/*  Overlay computation helpers                                        */
/* ------------------------------------------------------------------ */

function linearRegression(
  data: ChartRow[],
): { slope: number; intercept: number } | null {
  const points: { i: number; v: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].level != null) points.push({ i, v: data[i].level! });
  }
  if (points.length < 2) return null;

  const n = points.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (const p of points) {
    sumX += p.i;
    sumY += p.v;
    sumXY += p.i * p.v;
    sumXX += p.i * p.i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function logLinearRegression(
  data: ChartRow[],
): { slope: number; intercept: number } | null {
  const points: { i: number; v: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].level != null && data[i].level! > 0)
      points.push({ i, v: Math.log(data[i].level!) });
  }
  if (points.length < 2) return null;

  const n = points.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (const p of points) {
    sumX += p.i;
    sumY += p.v;
    sumXY += p.i * p.v;
    sumXX += p.i * p.i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** HP filter on a plain number array — returns trend values (same length). */
function hpFilterValues(y: number[], lambda = 14400): number[] {
  const n = y.length;
  if (n < 3) return [...y];

  const lam = lambda;

  // Build symmetric pentadiagonal A = I + λ·K'K
  const diag = new Float64Array(n);
  const off1 = new Float64Array(n);
  const off2 = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    let v = 1;
    if (i === 0 || i === n - 1) v += lam;
    else if (i === 1 || i === n - 2) v += 5 * lam;
    else v += 6 * lam;
    diag[i] = v;
  }
  for (let i = 0; i < n - 1; i++) {
    off1[i] = i === 0 || i === n - 2 ? -2 * lam : -4 * lam;
  }
  for (let i = 0; i < n - 2; i++) {
    off2[i] = lam;
  }

  // LDL' decomposition
  const dd = new Float64Array(n);
  const l1 = new Float64Array(n);
  const l2 = new Float64Array(n);

  dd[0] = diag[0];
  if (n > 1) {
    l1[0] = off1[0] / dd[0];
    if (n > 2) l2[0] = off2[0] / dd[0];
  }
  if (n > 1) {
    dd[1] = diag[1] - l1[0] * l1[0] * dd[0];
    if (n > 2) {
      l1[1] = (off1[1] - l2[0] * l1[0] * dd[0]) / dd[1];
      if (n > 3) l2[1] = off2[1] / dd[1];
    }
  }
  for (let i = 2; i < n; i++) {
    dd[i] =
      diag[i] -
      l1[i - 1] * l1[i - 1] * dd[i - 1] -
      l2[i - 2] * l2[i - 2] * dd[i - 2];
    if (i < n - 1)
      l1[i] = (off1[i] - l2[i - 1] * l1[i - 1] * dd[i - 1]) / dd[i];
    if (i < n - 2) l2[i] = off2[i] / dd[i];
  }

  // Forward substitution: L z = y
  const z = Float64Array.from(y);
  for (let i = 1; i < n; i++) {
    z[i] -= l1[i - 1] * z[i - 1];
    if (i >= 2) z[i] -= l2[i - 2] * z[i - 2];
  }

  // Diagonal solve: D w = z
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = z[i] / dd[i];

  // Back substitution: L^T τ = w
  const tau = new Float64Array(n);
  tau[n - 1] = w[n - 1];
  if (n > 1) tau[n - 2] = w[n - 2] - l1[n - 2] * tau[n - 1];
  for (let i = n - 3; i >= 0; i--) {
    tau[i] = w[i] - l1[i] * tau[i + 1] - l2[i] * tau[i + 2];
  }

  return Array.from(tau);
}

/** HP filter for ChartRow[] — maps non-null level values through hpFilterValues. */
function computeHpTrend(data: ChartRow[], lambda = 14400): number[] {
  const values: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].level != null) {
      values.push(data[i].level!);
      indices.push(i);
    }
  }
  if (values.length < 3) return [];

  const tau = hpFilterValues(values, lambda);

  // Map back to full-length array (NaN for missing level rows)
  const result = new Array<number>(data.length).fill(NaN);
  for (let j = 0; j < values.length; j++) result[indices[j]] = tau[j];
  return result;
}

export function computeOverlays(
  data: ChartRow[],
  overlays: Overlay[],
  window = 12,
  stdDevMultiplier = 1,
): ChartRow[] {
  if (overlays.length === 0) return data;

  const needLinear = overlays.includes("linearTrend");
  const needLogLinear = overlays.includes("logLinearTrend");
  const needHP = overlays.includes("hpTrend");
  const needRollingMean = overlays.includes("rollingMean");
  const needRollingStd = overlays.includes("rollingStdDev");

  const linReg = needLinear ? linearRegression(data) : null;
  const logReg = needLogLinear ? logLinearRegression(data) : null;
  const hpValues = needHP ? computeHpTrend(data) : null;
  const k = Math.max(2, window);

  return data.map((row, i) => {
    const updated: ChartRow = { ...row };

    if (linReg) {
      updated.linearTrend = linReg.intercept + linReg.slope * i;
    }
    if (logReg) {
      updated.logLinearTrend = Math.exp(logReg.intercept + logReg.slope * i);
    }
    if (hpValues && !isNaN(hpValues[i])) {
      updated.hpTrend = hpValues[i];
    }
    if (needRollingMean && i >= k - 1) {
      let sum = 0;
      let count = 0;
      for (let j = i - k + 1; j <= i; j++) {
        if (data[j].level != null) {
          sum += data[j].level!;
          count++;
        }
      }
      if (count === k) updated.rollingMean = sum / count;
    }
    if (needRollingStd && i >= k - 1) {
      let sum = 0;
      let count = 0;
      for (let j = i - k + 1; j <= i; j++) {
        if (data[j].level != null) {
          sum += data[j].level!;
          count++;
        }
      }
      if (count === k) {
        const mean = sum / count;
        let sumSq = 0;
        for (let j = i - k + 1; j <= i; j++) {
          if (data[j].level != null) sumSq += (data[j].level! - mean) ** 2;
        }
        const std = Math.sqrt(sumSq / (count - 1));
        updated.rollingStdUpper = mean + stdDevMultiplier * std;
        updated.rollingStdLower = mean - stdDevMultiplier * std;
        updated.rollingStdBand = 2 * stdDevMultiplier * std;
      }
    }

    return updated;
  });
}

/* ------------------------------------------------------------------ */
/*  Transformation helpers                                             */
/* ------------------------------------------------------------------ */

export function applyTransformation(
  data: ChartRow[],
  transform: Transformation | null,
  indexBaseYear?: number,
  rollingWindow = 12,
  indexBaseDate?: string,
  freqCode?: string | null,
): ChartRow[] {
  if (!transform) return data;

  const levels = data.map((r) => r.level).filter((v): v is number => v != null);
  if (levels.length === 0) return data;

  switch (transform) {
    case "zScore": {
      const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
      let sumSq = 0;
      for (const v of levels) sumSq += (v - mean) ** 2;
      const sd = Math.sqrt(sumSq / (levels.length - 1));
      if (sd === 0) return data;
      return data.map((row) => ({
        ...row,
        level: row.level != null ? (row.level - mean) / sd : null,
      }));
    }
    case "deviationFromTrend": {
      const reg = linearRegression(data);
      if (!reg) return data;
      return data.map((row, i) => ({
        ...row,
        level:
          row.level != null
            ? row.level - (reg.intercept + reg.slope * i)
            : null,
      }));
    }
    case "logLevel": {
      return data.map((row) => ({
        ...row,
        level: row.level != null && row.level > 0 ? Math.log(row.level) : null,
      }));
    }
    case "indexToYear": {
      let baseRow: ChartRow | undefined;
      if (indexBaseDate) {
        baseRow = data.find((r) => r.date === indexBaseDate && r.level != null);
      }
      if (!baseRow) {
        const year = indexBaseYear ?? 2015;
        baseRow = data.find(
          (r) => r.date.startsWith(String(year)) && r.level != null,
        );
      }
      if (!baseRow || baseRow.level === null || baseRow.level === 0)
        return data;
      const base = baseRow.level;
      return data.map((row) => ({
        ...row,
        level: row.level != null ? (row.level / base) * 100 : null,
      }));
    }
    case "rollingMean": {
      const k = Math.max(2, rollingWindow);
      return data.map((row, i) => {
        if (i < k - 1 || row.level == null) return row;
        let sum = 0;
        let count = 0;
        for (let j = i - k + 1; j <= i; j++) {
          if (data[j].level != null) {
            sum += data[j].level!;
            count++;
          }
        }
        return { ...row, level: count === k ? sum / count : null };
      });
    }
    case "linearTrend": {
      const reg = linearRegression(data);
      if (!reg) return data;
      return data.map((row, i) => ({
        ...row,
        level: row.level != null ? reg.intercept + reg.slope * i : null,
      }));
    }
    case "logLinearTrend": {
      const reg = logLinearRegression(data);
      if (!reg) return data;
      return data.map((row, i) => ({
        ...row,
        level:
          row.level != null ? Math.exp(reg.intercept + reg.slope * i) : null,
      }));
    }
    case "hpTrend": {
      const hp = computeHpTrend(data);
      if (hp.length === 0) return data;
      return data.map((row, i) => ({
        ...row,
        level: !isNaN(hp[i]) ? hp[i] : null,
      }));
    }
    case "yoy":
      return data.map((r) => ({ ...r, level: r.yoy }));
    case "ytd":
      return data.map((r) => ({ ...r, level: r.ytd }));
    case "pop":
      return data.map((r) => ({ ...r, level: r.pop }));
    case "levelChange":
      return data.map((r) => ({ ...r, level: r.levelChange }));
    case "cagr":
      return data.map((r) => ({ ...r, level: r.cagr }));
  }
}

/** Compute transformation as a second-axis field, keeping original level intact. */
export function computeSecondAxis(
  data: ChartRow[],
  transform: Transformation,
  indexBaseYear?: number,
  rollingWindow = 12,
  indexBaseDate?: string,
  freqCode?: string | null,
): ChartRow[] {
  const levels = data.map((r) => r.level).filter((v): v is number => v != null);
  if (levels.length === 0) return data;

  switch (transform) {
    case "zScore": {
      const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
      let sumSq = 0;
      for (const v of levels) sumSq += (v - mean) ** 2;
      const sd = Math.sqrt(sumSq / (levels.length - 1));
      if (sd === 0) return data;
      return data.map((row) => ({
        ...row,
        transformedLevel: row.level != null ? (row.level - mean) / sd : null,
      }));
    }
    case "deviationFromTrend": {
      const reg = linearRegression(data);
      if (!reg) return data;
      return data.map((row, i) => ({
        ...row,
        transformedLevel:
          row.level != null
            ? row.level - (reg.intercept + reg.slope * i)
            : null,
      }));
    }
    case "logLevel": {
      return data.map((row) => ({
        ...row,
        transformedLevel:
          row.level != null && row.level > 0 ? Math.log(row.level) : null,
      }));
    }
    case "indexToYear": {
      let baseRow: ChartRow | undefined;
      if (indexBaseDate) {
        baseRow = data.find((r) => r.date === indexBaseDate && r.level != null);
      }
      if (!baseRow) {
        const year = indexBaseYear ?? 2015;
        baseRow = data.find(
          (r) => r.date.startsWith(String(year)) && r.level != null,
        );
      }
      if (!baseRow || baseRow.level === null || baseRow.level === 0)
        return data;
      const base = baseRow.level;
      return data.map((row) => ({
        ...row,
        transformedLevel: row.level != null ? (row.level / base) * 100 : null,
      }));
    }
    case "rollingMean": {
      const k = Math.max(2, rollingWindow);
      return data.map((row, i) => {
        if (i < k - 1 || row.level == null) return row;
        let sum = 0;
        let count = 0;
        for (let j = i - k + 1; j <= i; j++) {
          if (data[j].level != null) {
            sum += data[j].level!;
            count++;
          }
        }
        return { ...row, transformedLevel: count === k ? sum / count : null };
      });
    }
    case "linearTrend": {
      const reg = linearRegression(data);
      if (!reg) return data;
      return data.map((row, i) => ({
        ...row,
        transformedLevel:
          row.level != null ? reg.intercept + reg.slope * i : null,
      }));
    }
    case "logLinearTrend": {
      const reg = logLinearRegression(data);
      if (!reg) return data;
      return data.map((row, i) => ({
        ...row,
        transformedLevel:
          row.level != null ? Math.exp(reg.intercept + reg.slope * i) : null,
      }));
    }
    case "hpTrend": {
      const hp = computeHpTrend(data);
      if (hp.length === 0) return data;
      return data.map((row, i) => ({
        ...row,
        transformedLevel: !isNaN(hp[i]) ? hp[i] : null,
      }));
    }
    case "yoy":
      return data.map((r) => ({ ...r, transformedLevel: r.yoy }));
    case "ytd":
      return data.map((r) => ({ ...r, transformedLevel: r.ytd }));
    case "pop":
      return data.map((r) => ({ ...r, transformedLevel: r.pop }));
    case "levelChange":
      return data.map((r) => ({ ...r, transformedLevel: r.levelChange }));
    case "cagr":
      return data.map((r) => ({ ...r, transformedLevel: r.cagr }));
  }
}

/** Apply a transformation independently to each series column (series_0, series_1, ...) */
export function applyTransformationMulti(
  data: ChartRow[],
  transform: Transformation | null,
  seriesCount: number,
  indexBaseYear?: number,
  rollingWindow = 12,
  indexBaseDate?: string,
  freqCode?: string | null,
): ChartRow[] {
  if (!transform || seriesCount === 0) return data;

  // Clone rows
  let rows = data.map((r) => ({ ...r }));

  for (let s = 0; s < seriesCount; s++) {
    const key = `series_${s}` as const;
    const values = rows
      .map((r) => r[key])
      .filter((v): v is number => v != null && !isNaN(v));
    if (values.length === 0) continue;

    switch (transform) {
      case "zScore": {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        let sumSq = 0;
        for (const v of values) sumSq += (v - mean) ** 2;
        const sd = Math.sqrt(sumSq / (values.length - 1));
        if (sd === 0) continue;
        rows = rows.map((row) => ({
          ...row,
          [key]: row[key] != null ? ((row[key] as number) - mean) / sd : null,
        }));
        break;
      }
      case "deviationFromTrend": {
        // Build linear regression on this column
        const points: { i: number; v: number }[] = [];
        for (let i = 0; i < rows.length; i++) {
          const v = rows[i][key];
          if (v != null && !isNaN(v)) points.push({ i, v });
        }
        if (points.length < 2) continue;
        const n = points.length;
        let sumX = 0,
          sumY = 0,
          sumXY = 0,
          sumXX = 0;
        for (const p of points) {
          sumX += p.i;
          sumY += p.v;
          sumXY += p.i * p.v;
          sumXX += p.i * p.i;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        rows = rows.map((row, i) => ({
          ...row,
          [key]:
            row[key] != null
              ? (row[key] as number) - (intercept + slope * i)
              : null,
        }));
        break;
      }
      case "logLevel": {
        rows = rows.map((row) => ({
          ...row,
          [key]:
            row[key] != null && (row[key] as number) > 0
              ? Math.log(row[key] as number)
              : null,
        }));
        break;
      }
      case "indexToYear": {
        let baseRow: ChartRow | undefined;
        if (indexBaseDate) {
          baseRow = rows.find(
            (r) =>
              r.date === indexBaseDate &&
              r[key] != null &&
              !isNaN(r[key] as number),
          );
        }
        if (!baseRow) {
          const year = indexBaseYear ?? 2015;
          baseRow = rows.find(
            (r) =>
              r.date.startsWith(String(year)) &&
              r[key] != null &&
              !isNaN(r[key] as number),
          );
        }
        if (!baseRow || baseRow[key] == null || (baseRow[key] as number) === 0)
          continue;
        const base = baseRow[key] as number;
        rows = rows.map((row) => ({
          ...row,
          [key]: row[key] != null ? ((row[key] as number) / base) * 100 : null,
        }));
        break;
      }
      case "rollingMean": {
        const k = Math.max(2, rollingWindow);
        rows = rows.map((row, i) => {
          if (i < k - 1 || row[key] == null) return row;
          let sum = 0;
          let count = 0;
          for (let j = i - k + 1; j <= i; j++) {
            const v = rows[j][key];
            if (v != null && !isNaN(v as number)) {
              sum += v as number;
              count++;
            }
          }
          return { ...row, [key]: count === k ? sum / count : null };
        });
        break;
      }
      case "linearTrend": {
        const points: { i: number; v: number }[] = [];
        for (let i = 0; i < rows.length; i++) {
          const v = rows[i][key];
          if (v != null && !isNaN(v as number))
            points.push({ i, v: v as number });
        }
        if (points.length < 2) continue;
        const pn = points.length;
        let sX = 0,
          sY = 0,
          sXY = 0,
          sXX = 0;
        for (const p of points) {
          sX += p.i;
          sY += p.v;
          sXY += p.i * p.v;
          sXX += p.i * p.i;
        }
        const slope = (pn * sXY - sX * sY) / (pn * sXX - sX * sX);
        const intercept = (sY - slope * sX) / pn;
        rows = rows.map((row, i) => ({
          ...row,
          [key]: row[key] != null ? intercept + slope * i : null,
        }));
        break;
      }
      case "logLinearTrend": {
        const points: { i: number; v: number }[] = [];
        for (let i = 0; i < rows.length; i++) {
          const v = rows[i][key];
          if (v != null && !isNaN(v as number) && (v as number) > 0)
            points.push({ i, v: Math.log(v as number) });
        }
        if (points.length < 2) continue;
        const pn = points.length;
        let sX = 0,
          sY = 0,
          sXY = 0,
          sXX = 0;
        for (const p of points) {
          sX += p.i;
          sY += p.v;
          sXY += p.i * p.v;
          sXX += p.i * p.i;
        }
        const slope = (pn * sXY - sX * sY) / (pn * sXX - sX * sX);
        const intercept = (sY - slope * sX) / pn;
        rows = rows.map((row, i) => ({
          ...row,
          [key]: row[key] != null ? Math.exp(intercept + slope * i) : null,
        }));
        break;
      }
      case "hpTrend": {
        // Extract non-null values and their indices for this series
        const seriesValues: number[] = [];
        const seriesIndices: number[] = [];
        for (let i = 0; i < rows.length; i++) {
          const v = rows[i][key];
          if (v != null && !isNaN(v as number)) {
            seriesValues.push(v as number);
            seriesIndices.push(i);
          }
        }
        if (seriesValues.length < 3) continue;
        const trend = hpFilterValues(seriesValues);
        rows = rows.map((row, i) => {
          const idx = seriesIndices.indexOf(i);
          return { ...row, [key]: idx >= 0 ? trend[idx] : null };
        });
        break;
      }
      case "pop": {
        // Period-over-period: (current - prev) / prev * 100
        const prev = new Array<number | null>(rows.length);
        for (let i = 0; i < rows.length; i++) prev[i] = rows[i][key] as number | null;
        rows = rows.map((row, i) => {
          if (i === 0 || row[key] == null) return row;
          const p = prev[i - 1];
          if (p == null || p === 0) return { ...row, [key]: null };
          return { ...row, [key]: ((row[key] as number) - p) / Math.abs(p) * 100 };
        });
        break;
      }
      case "levelChange": {
        const prev = new Array<number | null>(rows.length);
        for (let i = 0; i < rows.length; i++) prev[i] = rows[i][key] as number | null;
        rows = rows.map((row, i) => {
          if (i === 0 || row[key] == null) return row;
          const p = prev[i - 1];
          if (p == null) return { ...row, [key]: null };
          return { ...row, [key]: (row[key] as number) - p };
        });
        break;
      }
      case "yoy": {
        // Year-over-year: compare to same period last year
        const PPY: Record<string, number> = { D: 365, W: 52, M: 12, Q: 4, S: 2, A: 1 };
        const ppy = PPY[freqCode ?? "M"] ?? 12;
        const prev = rows.map((r) => r[key] as number | null);
        rows = rows.map((row, i) => {
          if (i < ppy || row[key] == null) return row;
          const p = prev[i - ppy];
          if (p == null || p === 0) return { ...row, [key]: null };
          return { ...row, [key]: ((row[key] as number) - p) / Math.abs(p) * 100 };
        });
        break;
      }
      case "ytd": {
        // Year-to-date cumulative % change from first obs of the year
        let yearStart: number | null = null;
        let currentYear = "";
        const orig = rows.map((r) => r[key] as number | null);
        rows = rows.map((row, i) => {
          if (orig[i] == null) return row;
          const yr = row.date.slice(0, 4);
          if (yr !== currentYear) {
            currentYear = yr;
            yearStart = orig[i];
            return { ...row, [key]: null }; // first obs of year has no YTD
          }
          if (yearStart == null || yearStart === 0) return { ...row, [key]: null };
          return { ...row, [key]: ((orig[i] as number) - yearStart) / Math.abs(yearStart) * 100 };
        });
        break;
      }
      case "cagr": {
        // Running CAGR from first observation
        const PPY: Record<string, number> = { D: 365, W: 52, M: 12, Q: 4, S: 2, A: 1 };
        const ppy = PPY[freqCode ?? "M"] ?? 12;
        let firstVal: number | null = null;
        let periodIdx = 0;
        const orig = rows.map((r) => r[key] as number | null);
        rows = rows.map((row, i) => {
          const v = orig[i];
          if (v == null) return row;
          if (firstVal == null) {
            firstVal = v;
            periodIdx++;
            return { ...row, [key]: null };
          }
          const idx = periodIdx;
          periodIdx++;
          if (firstVal <= 0 || v <= 0 || idx === 0) return { ...row, [key]: null };
          return { ...row, [key]: (Math.pow(v / firstVal, ppy / idx) - 1) * 100 };
        });
        break;
      }
    }
  }

  return rows;
}

export const TRANSFORMATION_LABELS: Record<Transformation, string> = {
  zScore: "Z-Score",
  deviationFromTrend: "Dev. from Trend",
  logLevel: "Log Level",
  indexToYear: "Index",
  rollingMean: "Rolling x̄",
  linearTrend: "Linear Trend",
  logLinearTrend: "Log-Linear Trend",
  hpTrend: "HP Trend",
  yoy: "YOY %",
  ytd: "YTD %",
  pop: "PoP %",
  levelChange: "LVL Chg",
  cagr: "CAGR",
};

/* ------------------------------------------------------------------ */
/*  Shared custom tooltip                                              */
/* ------------------------------------------------------------------ */

/** Per-point overlay fields shown in tooltip when active */
const OVERLAY_TOOLTIP_FIELDS: {
  overlay: Overlay;
  key: keyof ChartRow;
  label: string;
  color: string;
}[] = [
  {
    overlay: "rollingMean",
    key: "rollingMean",
    label: "Rolling x̄",
    color: "#f59e0b",
  },
  {
    overlay: "linearTrend",
    key: "linearTrend",
    label: "Linear",
    color: "#8b5cf6",
  },
  {
    overlay: "logLinearTrend",
    key: "logLinearTrend",
    label: "Log-Linear",
    color: "#8b5cf6",
  },
  { overlay: "hpTrend", key: "hpTrend", label: "HP Trend", color: "#0d9488" },
  {
    overlay: "rollingStdDev",
    key: "rollingStdUpper",
    label: "+σ",
    color: "#94a3b8",
  },
  {
    overlay: "rollingStdDev",
    key: "rollingStdLower",
    label: "−σ",
    color: "#94a3b8",
  },
];

interface ChartTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  decimals: number;
  unitShortLabel?: string | null;
  overlays?: Overlay[];
  secondAxis?: boolean;
  transformationLabel?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  decimals,
  unitShortLabel,
  overlays = [],
  secondAxis = false,
  transformationLabel,
}: ChartTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  const fmt = (v: number | null | undefined) =>
    v != null && !isNaN(v) ? formatLevel(v, decimals, unitShortLabel) : "—";
  const fmtPlain = (v: number | null | undefined) =>
    v != null && !isNaN(v) ? v.toFixed(decimals) : "—";
  const fmtPct = (v: number | null) => (v != null ? `${v.toFixed(2)}%` : "—");

  const activeOverlayFields = OVERLAY_TOOLTIP_FIELDS.filter(
    (f) => overlays.includes(f.overlay) && row[f.key] != null,
  );

  return (
    <div className="rounded-md border bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-slate-500">
        {formatDate(label)}
      </p>
      <p
        className="text-sm font-semibold"
        style={{ color: "var(--color-ublue)" }}
      >
        Level: {fmt(row.level)}
      </p>
      {secondAxis && row.transformedLevel != null && (
        <p className="text-sm font-semibold" style={{ color: "#e11d48" }}>
          {transformationLabel ?? "2nd Axis"}: {fmtPlain(row.transformedLevel)}
        </p>
      )}
      {activeOverlayFields.length > 0 && (
        <div className="mt-1 space-y-0.5 border-t pt-1 text-xs">
          {activeOverlayFields.map((f) => (
            <p key={f.key} style={{ color: f.color }}>
              {f.label}: {fmt(row[f.key] as number | null)}
            </p>
          ))}
        </div>
      )}
      <div className="mt-1 space-y-0.5 border-t pt-1 text-xs text-slate-600">
        <p>LVL Chg: {fmt(row.levelChange)}</p>
        <p>YOY %: {fmtPct(row.yoy)}</p>
        <p>YTD %: {fmtPct(row.ytd)}</p>
        <p>PoP %: {fmtPct(row.pop)}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CompareTooltip — tooltip for multi-series compare mode             */
/* ------------------------------------------------------------------ */

interface CompareTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  decimals: number;
  seriesNames: string[];
  seriesVisibility?: Map<number, "gray" | "hidden">;
  unitLabels?: Map<number, string>;
}

function CompareTooltip({
  active,
  payload,
  label,
  decimals,
  seriesNames,
  seriesVisibility,
  unitLabels,
}: CompareTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  return (
    <div className="rounded-md border bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-slate-500">
        {formatDate(label)}
      </p>
      {seriesNames.map((name, i) => {
        if (seriesVisibility?.get(i) === "hidden") return null;
        const v = row[`series_${i}`];
        const vis = seriesVisibility?.get(i);
        const unitSuffix = unitLabels?.get(i);
        return (
          <p
            key={name}
            className="text-sm font-semibold"
            style={{
              color:
                vis === "gray"
                  ? "#94a3b8"
                  : SERIES_COLORS[i % SERIES_COLORS.length],
            }}
          >
            {name}: {v != null && !isNaN(v) ? v.toFixed(decimals) : "—"}
            {unitSuffix ? (
              <span className="ml-1 text-xs font-normal text-slate-400">
                {unitSuffix}
              </span>
            ) : null}
          </p>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LevelChart — Primary line chart showing level data                */
/* ------------------------------------------------------------------ */

/**
 * Snap an event date to the nearest chart data point.
 * For x1 (start): find the last data point <= eventDate.
 * For x2 (end): find the first data point >= eventDate.
 * Returns undefined if the date is out of the data range (no clamping).
 */
function snapToDataPoint(
  chartData: ChartRow[],
  eventDate: string,
  mode: "start" | "end",
): string | undefined {
  if (chartData.length === 0) return undefined;
  if (mode === "start") {
    // Last data point <= eventDate
    let best: string | undefined;
    for (const r of chartData) {
      if (r.date <= eventDate) best = r.date;
      else break; // sorted ascending
    }
    return best; // undefined if event starts after all data
  }
  // mode === "end": first data point >= eventDate
  for (const r of chartData) {
    if (r.date >= eventDate) return r.date;
  }
  return undefined; // undefined if event ends before all data
}

interface LevelChartProps {
  data: ChartRow[];
  decimals: number;
  stats?: { mean: number; median: number | null; standardDeviation: number };
  overlays?: Overlay[];
  unitShortLabel?: string | null;
  secondAxis?: boolean;
  transformationLabel?: string;
  freqCode?: string | null;
  rollingWindow?: number;
  /** When indexToYear transform is active, draw a vertical reference line at this year */
  indexBaseYear?: number;
  /** Exact date for index reference line (preferred over indexBaseYear when provided) */
  indexDate?: string;
  /** Multi-series compare mode: series names corresponding to series_0, series_1, ... */
  seriesNames?: string[];
  /** 3-state visibility: absent = colored, "gray" = muted, "hidden" = not rendered */
  seriesVisibility?: Map<number, "gray" | "hidden">;
  /** Per-series Y-axis assignment ("left" or "right") */
  seriesAxisMap?: Map<number, "left" | "right">;
  /** Label for left Y-axis (dual-axis mode) */
  leftAxisLabel?: string;
  /** Label for right Y-axis (dual-axis mode) */
  rightAxisLabel?: string;
  /** Per-series unit labels for tooltip */
  seriesUnitLabels?: Map<number, string>;
  /** Selected timeline events to render as shaded regions */
  selectedEvents?: TimelineEventForChart[];
  /** Brush props for compare mode (brush rendered inside LevelChart) */
  brushStartIndex?: number;
  brushEndIndex?: number;
  onBrushChange?: (range: { startIndex?: number; endIndex?: number }) => void;
  /** Chart type for left axis: "line" (default) or "column" */
  leftChartType?: "line" | "column";
  /** Chart type for right axis: "line" (default) or "column" */
  rightChartType?: "line" | "column";
  /** Standard deviation multiplier (1, 2, or 3) for ±σ bands */
  stdDevMultiplier?: number;
}

/**
 * Insert a single null-valued row wherever consecutive dates are further
 * apart than expected for the given frequency.  This causes Recharts'
 * `connectNulls={false}` to visually break the line at gaps (e.g. missing
 * months during COVID).
 */
function fillGaps(rows: ChartRow[], freqCode: string | null | undefined): ChartRow[] {
  if (rows.length < 2) return rows;
  const DAY = 86_400_000;
  // Maximum gap (in ms) before we consider data missing
  const maxGap: Record<string, number> = {
    D: 3 * DAY,
    W: 10 * DAY,
    M: 45 * DAY,
    Q: 105 * DAY,
    S: 200 * DAY,
    A: 400 * DAY,
  };
  const threshold = maxGap[freqCode ?? "M"] ?? 45 * DAY;

  const result: ChartRow[] = [rows[0]];
  for (let i = 1; i < rows.length; i++) {
    const prevMs = new Date(rows[i - 1].date).getTime();
    const currMs = new Date(rows[i].date).getTime();
    if (currMs - prevMs > threshold) {
      // Insert a null placeholder one day after the last real point
      result.push({
        date: new Date(prevMs + DAY).toISOString().slice(0, 10),
        level: null,
        levelChange: null,
        yoy: null,
        ytd: null,
        pop: null,
        cagr: null,
      });
    }
    result.push(rows[i]);
  }
  return result;
}

export function LevelChart({
  data,
  decimals,
  stats,
  overlays = [],
  unitShortLabel,
  secondAxis = false,
  transformationLabel,
  freqCode,
  rollingWindow = 12,
  indexBaseYear,
  seriesNames,
  seriesVisibility,
  seriesAxisMap,
  leftAxisLabel,
  rightAxisLabel,
  seriesUnitLabels,
  selectedEvents = [],
  brushStartIndex,
  brushEndIndex,
  onBrushChange,
  leftChartType = "line",
  rightChartType = "line",
  indexDate,
  stdDevMultiplier = 1,
}: LevelChartProps) {
  const isCompareMode = seriesNames && seriesNames.length >= 1;

  const chartData = useMemo(() => {
    const rows = isCompareMode
      ? data
      : computeOverlays(data, overlays, rollingWindow, stdDevMultiplier);
    return fillGaps(rows, freqCode);
  }, [data, overlays, rollingWindow, stdDevMultiplier, isCompareMode, freqCode]);

  const { ticks, tickFormatter } = useMemo(() => {
    const dates = chartData.map((r) => r.date);
    const freq = freqCode ?? detectFrequency(dates);
    const t = computeAxisTicks(dates, freq);
    return { ticks: t, tickFormatter: makeAxisTickFormatter(freq, t) };
  }, [chartData, freqCode]);

  if (chartData.length === 0) return null;

  // Find the date string for the index base reference line
  const indexBaseDate = indexDate
    ? indexDate
    : indexBaseYear
      ? chartData.find((r) => r.date.startsWith(String(indexBaseYear)))?.date
      : undefined;

  // ── Map brush indices between original data and gap-filled chartData ──
  const mappedBrushStart = useMemo(() => {
    if (brushStartIndex == null || data.length === chartData.length) return brushStartIndex;
    const date = data[brushStartIndex]?.date;
    if (!date) return brushStartIndex;
    const idx = chartData.findIndex((r) => r.date >= date);
    return idx >= 0 ? idx : brushStartIndex;
  }, [brushStartIndex, data, chartData]);

  const mappedBrushEnd = useMemo(() => {
    if (brushEndIndex == null || data.length === chartData.length) return brushEndIndex;
    const date = data[brushEndIndex]?.date;
    if (!date) return brushEndIndex;
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].date <= date) return i;
    }
    return brushEndIndex;
  }, [brushEndIndex, data, chartData]);

  // Reverse-map gap-filled indices back to original data indices for the parent
  const handleGapAwareBrushChange = useCallback(
    (range: { startIndex?: number; endIndex?: number }) => {
      if (!onBrushChange) return;
      if (data.length === chartData.length) {
        onBrushChange(range);
        return;
      }
      const mapToOriginal = (gapIdx: number | undefined) => {
        if (gapIdx == null) return gapIdx;
        const date = chartData[gapIdx]?.date;
        if (!date) return gapIdx;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i].date <= date) return i;
        }
        return 0;
      };
      onBrushChange({
        startIndex: mapToOriginal(range.startIndex),
        endIndex: mapToOriginal(range.endIndex),
      });
    },
    [onBrushChange, data, chartData],
  );

  // ── Multi-series compare mode ──────────────────────────────────────
  if (isCompareMode) {
    const hasRight = seriesAxisMap
      ? [...seriesAxisMap.values()].some((v) => v === "right")
      : false;

    // Use brush range (not full data range) so events outside the visible
    // window don't get rendered and throw off the chart axis.
    const compareFirstDate =
      chartData[mappedBrushStart ?? 0]?.date ?? chartData[0]?.date ?? "";
    const compareLastDate =
      chartData[mappedBrushEnd ?? chartData.length - 1]?.date ??
      chartData[chartData.length - 1]?.date ??
      "";
    const compareVisibleEvents = selectedEvents.filter(
      (e) => e.start <= compareLastDate && e.end >= compareFirstDate,
    );

    return (
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart
          data={chartData}
          margin={{
            top: indexBaseDate ? 24 : 10,
            right: hasRight ? 10 : 10,
            bottom: 0,
            left: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={tickFormatter}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="left"
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatValue(v, decimals)}
            tick={{ fontSize: 11 }}
            width={70}
            label={
              hasRight && leftAxisLabel
                ? {
                    value: leftAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "#6b7280" },
                  }
                : undefined
            }
          />
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => formatValue(v, decimals)}
              tick={{ fontSize: 11 }}
              width={70}
              label={
                rightAxisLabel
                  ? {
                      value: rightAxisLabel,
                      angle: 90,
                      position: "insideRight",
                      style: { fontSize: 11, fill: "#6b7280" },
                    }
                  : undefined
              }
            />
          )}
          <Tooltip
            content={
              <CompareTooltip
                decimals={decimals}
                seriesNames={seriesNames}
                seriesVisibility={seriesVisibility}
                unitLabels={seriesUnitLabels}
              />
            }
          />
          {seriesNames.map((name, i) => {
            const vis = seriesVisibility?.get(i);
            if (vis === "hidden") return null;
            const axisId = seriesAxisMap?.get(i) ?? "left";
            return (
              <Line
                key={name}
                type="monotone"
                dataKey={`series_${i}`}
                name={name}
                yAxisId={axisId}
                stroke={
                  vis === "gray"
                    ? "#94a3b8"
                    : SERIES_COLORS[i % SERIES_COLORS.length]
                }
                strokeWidth={vis === "gray" ? 1 : 2}
                strokeOpacity={vis === "gray" ? 0.4 : 1}
                dot={false}
                isAnimationActive={true}
                animationDuration={400}
                connectNulls={false}
              />
            );
          })}
          {/* Timeline event shading (compare mode) */}
          {compareVisibleEvents.map((e) => {
            const x1 = snapToDataPoint(chartData, e.start, "start");
            let x2 = snapToDataPoint(chartData, e.end, "end");
            if (!x1 || !x2 || x1 > x2) return null;
            if (x1 === x2) {
              const idx = chartData.findIndex((r) => r.date === x1);
              if (idx >= 0 && idx < chartData.length - 1) {
                x2 = chartData[idx + 1].date;
              }
            }
            return (
              <ReferenceArea
                key={`${e.id}-${e.start}`}
                x1={x1}
                x2={x2}
                fill="#94a3b8"
                fillOpacity={0.15}
                strokeOpacity={0}
                yAxisId="left"
                label={{
                  value: e.name,
                  position: "insideTop",
                  fontSize: 9,
                  fill: "transparent",
                  className: "timeline-event-label",
                }}
              />
            );
          })}
          {indexBaseDate && (
            <ReferenceLine
              x={indexBaseDate}
              yAxisId="left"
              stroke="#6366f1"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: indexBaseDate,
                position: "top",
                fontSize: 11,
                fill: "#6366f1",
                fontWeight: 600,
              }}
            />
          )}
          {indexBaseDate && (
            <ReferenceLine
              y={100}
              yAxisId="left"
              stroke="#6366f1"
              strokeDasharray="3 4"
              strokeWidth={1}
              strokeOpacity={0.4}
            />
          )}
          {onBrushChange && (
            <Brush
              dataKey="date"
              height={30}
              stroke="var(--color-ublue)"
              tickFormatter={formatDate}
              startIndex={mappedBrushStart ?? 0}
              endIndex={mappedBrushEnd ?? chartData.length - 1}
              onChange={handleGapAwareBrushChange}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // ── Standard single-series mode ────────────────────────────────────

  const firstDate = chartData[0].date;
  const lastDate = chartData[chartData.length - 1].date;
  const visibleEvents = selectedEvents.filter(
    (e) => e.start <= lastDate && e.end >= firstDate,
  );

  const hasSecondAxis =
    secondAxis && data.some((r) => r.transformedLevel != null);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart
        data={chartData}
        margin={{
          top: indexBaseDate ? 24 : 10,
          right: hasSecondAxis ? 10 : 10,
          bottom: 0,
          left: 0,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="date"
          ticks={ticks}
          tickFormatter={tickFormatter}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          yAxisId="left"
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => formatValue(v, decimals)}
          tick={{ fontSize: 11 }}
          width={70}
        />
        {hasSecondAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={{ fontSize: 11 }}
            width={60}
            label={{
              value: transformationLabel ?? "",
              angle: 90,
              position: "insideRight",
              fontSize: 10,
              fill: "#e11d48",
            }}
          />
        )}
        <Tooltip
          content={
            <ChartTooltip
              decimals={decimals}
              unitShortLabel={unitShortLabel}
              overlays={overlays}
              secondAxis={secondAxis}
              transformationLabel={transformationLabel}
            />
          }
        />
        {/* Right axis rendered first so it draws behind the left axis */}
        {hasSecondAxis && (
          rightChartType === "column" ? (
            <Bar
              dataKey="transformedLevel"
              yAxisId="right"
              fill="#e11d48"
              fillOpacity={0.5}
              isAnimationActive={true}
              animationDuration={400}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="transformedLevel"
              yAxisId="right"
              stroke="#e11d48"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              isAnimationActive={true}
              animationDuration={400}
              connectNulls={false}
            />
          )
        )}
        {/* Main level — left axis */}
        {leftChartType === "column" ? (
          <Bar
            dataKey="level"
            yAxisId="left"
            fill="var(--color-ublue)"
            fillOpacity={0.7}
            isAnimationActive={true}
            animationDuration={400}
          />
        ) : (
          <Line
            type="monotone"
            dataKey="level"
            yAxisId="left"
            stroke="var(--color-ublue)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={400}
            connectNulls={false}
          />
        )}
        {/* Timeline event shading */}
        {visibleEvents.map((e) => {
          const x1 = snapToDataPoint(chartData, e.start, "start");
          let x2 = snapToDataPoint(chartData, e.end, "end");
          if (!x1 || !x2 || x1 > x2) return null;
          // Enforce minimum visual width for single-day / narrow events
          if (x1 === x2) {
            const idx = chartData.findIndex((r) => r.date === x1);
            if (idx >= 0 && idx < chartData.length - 1) {
              x2 = chartData[idx + 1].date;
            }
          }
          return (
            <ReferenceArea
              key={`${e.id}-${e.start}`}
              x1={x1}
              x2={x2}
              fill="#94a3b8"
              fillOpacity={0.15}
              strokeOpacity={0}
              yAxisId="left"
              label={{
                value: e.name,
                position: "insideTop",
                fontSize: 9,
                fill: "transparent",
                className: "timeline-event-label",
              }}
            />
          );
        })}
        {/* Full-sample ±σ filled band */}
        {stats && overlays.includes("stdDev") && (
          <ReferenceArea
            y1={stats.mean - stdDevMultiplier * stats.standardDeviation}
            y2={stats.mean + stdDevMultiplier * stats.standardDeviation}
            yAxisId="left"
            fill="#7c3aed"
            fillOpacity={0.08}
            strokeOpacity={0}
          />
        )}
        {/* Full-sample ±σ edge lines with labels */}
        {stats && overlays.includes("stdDev") && (
          <ReferenceLine
            y={stats.mean + stdDevMultiplier * stats.standardDeviation}
            yAxisId="left"
            stroke="#7c3aed"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: `+${stdDevMultiplier}σ: ${formatLevel(stats.mean + stdDevMultiplier * stats.standardDeviation, decimals, unitShortLabel)}`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "#7c3aed",
            }}
          />
        )}
        {stats && overlays.includes("stdDev") && (
          <ReferenceLine
            y={stats.mean - stdDevMultiplier * stats.standardDeviation}
            yAxisId="left"
            stroke="#7c3aed"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: `-${stdDevMultiplier}σ: ${formatLevel(stats.mean - stdDevMultiplier * stats.standardDeviation, decimals, unitShortLabel)}`,
              position: "insideBottomRight",
              fontSize: 10,
              fill: "#7c3aed",
            }}
          />
        )}
        {/* Historical mean */}
        {stats && overlays.includes("mean") && (
          <ReferenceLine
            y={stats.mean}
            yAxisId="left"
            stroke="#16a34a"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: `Mean: ${formatLevel(stats.mean, decimals, unitShortLabel)}`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "#16a34a",
            }}
          />
        )}
        {/* Rolling σ filled band (stacked: transparent base + colored band) */}
        {overlays.includes("rollingStdDev") && (
          <Area
            type="monotone"
            dataKey="rollingStdLower"
            yAxisId="left"
            stackId="rollingStd"
            fill="transparent"
            stroke="transparent"
            isAnimationActive={true}
            animationDuration={400}
            connectNulls={false}
          />
        )}
        {overlays.includes("rollingStdDev") && (
          <Area
            type="monotone"
            dataKey="rollingStdBand"
            yAxisId="left"
            stackId="rollingStd"
            fill="#f59e0b"
            fillOpacity={0.1}
            stroke="#f59e0b"
            strokeWidth={1}
            strokeOpacity={0.4}
            isAnimationActive={true}
            animationDuration={400}
            connectNulls={false}
          />
        )}
        {/* Index base year reference line */}
        {indexBaseDate && (
          <ReferenceLine
            x={indexBaseDate}
            yAxisId="left"
            stroke="#6366f1"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: String(indexBaseYear),
              position: "top",
              fontSize: 11,
              fill: "#6366f1",
              fontWeight: 600,
            }}
          />
        )}
        {/* Index = 100 baseline */}
        {indexBaseDate && (
          <ReferenceLine
            y={100}
            yAxisId="left"
            stroke="#6366f1"
            strokeDasharray="3 4"
            strokeWidth={1}
            strokeOpacity={0.4}
          />
        )}
        {/* Rolling mean */}
        {overlays.includes("rollingMean") && (
          <Line
            type="monotone"
            dataKey="rollingMean"
            yAxisId="left"
            stroke="#f59e0b"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={true}
            animationDuration={400}
            connectNulls={false}
          />
        )}
        {/* Linear trend */}
        {overlays.includes("linearTrend") && (
          <Line
            type="monotone"
            dataKey="linearTrend"
            yAxisId="left"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            strokeDasharray="8 4"
            dot={false}
            isAnimationActive={true}
            animationDuration={400}
            connectNulls={false}
          />
        )}
        {/* Log-linear trend */}
        {overlays.includes("logLinearTrend") && (
          <Line
            type="monotone"
            dataKey="logLinearTrend"
            yAxisId="left"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            strokeDasharray="2 3"
            dot={false}
            isAnimationActive={true}
            animationDuration={400}
            connectNulls={false}
          />
        )}
        {/* HP trend */}
        {overlays.includes("hpTrend") && (
          <Line
            type="monotone"
            dataKey="hpTrend"
            yAxisId="left"
            stroke="#0d9488"
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={400}
            connectNulls={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  ChangeChart — Secondary bar chart with Brush for date range       */
/* ------------------------------------------------------------------ */

interface ChangeChartProps {
  data: ChartRow[];
  decimals: number;
  barMode: BarMode;
  brushStartIndex: number;
  brushEndIndex: number;
  onBrushChange: (range: { startIndex?: number; endIndex?: number }) => void;
  unitShortLabel?: string | null;
  freqCode?: string | null;
}

export function ChangeChart({
  data,
  decimals,
  barMode,
  brushStartIndex,
  brushEndIndex,
  onBrushChange,
  unitShortLabel,
  freqCode,
}: ChangeChartProps) {
  const { ticks, tickFormatter } = useMemo(() => {
    const dates = data.map((r) => r.date);
    const freq = freqCode ?? detectFrequency(dates);
    const t = computeAxisTicks(dates, freq);
    return { ticks: t, tickFormatter: makeAxisTickFormatter(freq, t) };
  }, [data, freqCode]);

  if (data.length === 0) return null;

  const isPercent = barMode === "yoy" || barMode === "ytd" || barMode === "pop";

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="date"
          ticks={ticks}
          tickFormatter={tickFormatter}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickFormatter={(v: number) =>
            isPercent ? `${v.toFixed(1)}%` : formatValue(v, decimals)
          }
          tick={{ fontSize: 11 }}
          width={60}
        />
        <Tooltip
          content={
            <ChartTooltip decimals={decimals} unitShortLabel={unitShortLabel} />
          }
        />
        <Bar
          dataKey={barMode}
          fill="var(--color-ucyan)"
          opacity={0.6}
          isAnimationActive={true}
          animationDuration={600}
        />
        {data.length > 24 && (
          <Brush
            dataKey="date"
            height={30}
            stroke="var(--color-ublue)"
            tickFormatter={formatDate}
            startIndex={brushStartIndex ?? 0}
            endIndex={brushEndIndex ?? data.length - 1}
            onChange={onBrushChange}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
