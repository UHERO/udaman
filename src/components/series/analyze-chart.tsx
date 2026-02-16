"use client";

import { useMemo } from "react";

import { formatLevel } from "@catalog/utils/format";

import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type BarMode = "yoy" | "ytd" | "levelChange";

export const BAR_LABELS: Record<BarMode, string> = {
  yoy: "YOY %",
  ytd: "YTD %",
  levelChange: "LVL Chg",
};

export const SERIES_COLORS = [
  "var(--color-ublue)",
  "#e11d48",
  "#16a34a",
  "#f59e0b",
  "#8b5cf6",
  "#0d9488",
  "#ea580c",
  "#6366f1",
  "#d946ef",
  "#64748b",
];

export interface ChartRow {
  date: string;
  level: number | null;
  levelChange: number | null;
  yoy: number | null;
  ytd: number | null;
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
  // Dynamic series columns for multi-series compare mode (series_0, series_1, ...)
  [key: `series_${number}`]: number | null | undefined;
}

export type Overlay =
  | "rollingMean"
  | "linearTrend"
  | "logLinearTrend"
  | "hpTrend"
  | "mean"
  | "stdDev"
  | "rollingStdDev"
  | "recessions";

export type Transformation = "zScore" | "deviationFromTrend" | "logLevel";

export const formatDate = (d: string) => d;

/* ------------------------------------------------------------------ */
/*  X-axis date formatting                                             */
/* ------------------------------------------------------------------ */

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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
function computeAxisTicks(
  dates: string[],
  freqCode: string,
): string[] {
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
/*  NBER Recession Dates                                               */
/* ------------------------------------------------------------------ */

export const NBER_RECESSIONS = [
  { start: "1960-04-01", end: "1961-02-01" },
  { start: "1969-12-01", end: "1970-11-01" },
  { start: "1973-11-01", end: "1975-03-01" },
  { start: "1980-01-01", end: "1980-07-01" },
  { start: "1981-07-01", end: "1982-11-01" },
  { start: "1990-07-01", end: "1991-03-01" },
  { start: "2001-03-01", end: "2001-11-01" },
  { start: "2007-12-01", end: "2009-06-01" },
  { start: "2020-02-01", end: "2020-04-01" },
];

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

function computeHpTrend(data: ChartRow[], lambda = 14400): number[] {
  const values: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].level != null) {
      values.push(data[i].level!);
      indices.push(i);
    }
  }
  const n = values.length;
  if (n < 3) return [];

  const y = values;
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

  // Map back to full-length array (null for missing level rows)
  const result = new Array<number>(data.length).fill(NaN);
  for (let j = 0; j < n; j++) result[indices[j]] = tau[j];
  return result;
}

export function computeOverlays(
  data: ChartRow[],
  overlays: Overlay[],
  window = 12,
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
        updated.rollingStdUpper = mean + std;
        updated.rollingStdLower = mean - std;
        updated.rollingStdBand = 2 * std;
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
          row.level != null ? row.level - (reg.intercept + reg.slope * i) : null,
      }));
    }
    case "logLevel": {
      return data.map((row) => ({
        ...row,
        level: row.level != null && row.level > 0 ? Math.log(row.level) : null,
      }));
    }
  }
}

/** Compute transformation as a second-axis field, keeping original level intact. */
export function computeSecondAxis(
  data: ChartRow[],
  transform: Transformation,
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
  }
}

/** Apply a transformation independently to each series column (series_0, series_1, ...) */
export function applyTransformationMulti(
  data: ChartRow[],
  transform: Transformation | null,
  seriesCount: number,
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
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
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
          [key]: row[key] != null ? (row[key] as number) - (intercept + slope * i) : null,
        }));
        break;
      }
      case "logLevel": {
        rows = rows.map((row) => ({
          ...row,
          [key]: row[key] != null && (row[key] as number) > 0
            ? Math.log(row[key] as number)
            : null,
        }));
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
  { overlay: "rollingMean", key: "rollingMean", label: "Rolling x̄", color: "#f59e0b" },
  { overlay: "linearTrend", key: "linearTrend", label: "Linear", color: "#8b5cf6" },
  { overlay: "logLinearTrend", key: "logLinearTrend", label: "Log-Linear", color: "#8b5cf6" },
  { overlay: "hpTrend", key: "hpTrend", label: "HP Trend", color: "#0d9488" },
  { overlay: "rollingStdDev", key: "rollingStdUpper", label: "+σ", color: "#94a3b8" },
  { overlay: "rollingStdDev", key: "rollingStdLower", label: "−σ", color: "#94a3b8" },
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
  const fmtPct = (v: number | null) =>
    v != null ? `${v.toFixed(2)}%` : "—";

  const activeOverlayFields = OVERLAY_TOOLTIP_FIELDS.filter(
    (f) => overlays.includes(f.overlay) && row[f.key] != null
  );

  return (
    <div className="rounded-md border bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-slate-500">
        {formatDate(label)}
      </p>
      <p className="text-sm font-semibold" style={{ color: "var(--color-ublue)" }}>
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
}

function CompareTooltip({
  active,
  payload,
  label,
  decimals,
  seriesNames,
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
        const v = row[`series_${i}`];
        return (
          <p
            key={name}
            className="text-sm font-semibold"
            style={{ color: SERIES_COLORS[i % SERIES_COLORS.length] }}
          >
            {name}: {v != null && !isNaN(v) ? v.toFixed(decimals) : "—"}
          </p>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LevelChart — Primary line chart showing level data                */
/* ------------------------------------------------------------------ */

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
  /** Multi-series compare mode: series names corresponding to series_0, series_1, ... */
  seriesNames?: string[];
  /** Brush props for compare mode (brush rendered inside LevelChart) */
  brushStartIndex?: number;
  brushEndIndex?: number;
  onBrushChange?: (range: { startIndex?: number; endIndex?: number }) => void;
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
  seriesNames,
  brushStartIndex,
  brushEndIndex,
  onBrushChange,
}: LevelChartProps) {
  const isCompareMode = seriesNames && seriesNames.length >= 2;

  const chartData = useMemo(
    () => (isCompareMode ? data : computeOverlays(data, overlays, rollingWindow)),
    [data, overlays, rollingWindow, isCompareMode],
  );

  const { ticks, tickFormatter } = useMemo(() => {
    const dates = chartData.map((r) => r.date);
    const freq = freqCode ?? detectFrequency(dates);
    const t = computeAxisTicks(dates, freq);
    return { ticks: t, tickFormatter: makeAxisTickFormatter(freq, t) };
  }, [chartData, freqCode]);

  if (chartData.length === 0) return null;

  // ── Multi-series compare mode ──────────────────────────────────────
  if (isCompareMode) {
    return (
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
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
          <Tooltip
            content={
              <CompareTooltip
                decimals={decimals}
                seriesNames={seriesNames}
              />
            }
          />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs">{value}</span>
            )}
          />
          {seriesNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={`series_${i}`}
              name={name}
              yAxisId="left"
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={400}
              connectNulls
            />
          ))}
          {chartData.length > 24 && onBrushChange && (
            <Brush
              dataKey="date"
              height={30}
              stroke="var(--color-ublue)"
              tickFormatter={formatDate}
              startIndex={brushStartIndex}
              endIndex={brushEndIndex}
              onChange={onBrushChange}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // ── Standard single-series mode ────────────────────────────────────

  const firstDate = chartData[0].date;
  const lastDate = chartData[chartData.length - 1].date;
  const visibleRecessions = overlays.includes("recessions")
    ? NBER_RECESSIONS.filter((r) => r.start <= lastDate && r.end >= firstDate)
    : [];

  const hasSecondAxis = secondAxis && data.some((r) => r.transformedLevel != null);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: hasSecondAxis ? 10 : 10, bottom: 0, left: 0 }}
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
        {/* Recession shading */}
        {visibleRecessions.map((r) => (
          <ReferenceArea
            key={r.start}
            x1={r.start < firstDate ? firstDate : r.start}
            x2={r.end > lastDate ? lastDate : r.end}
            fill="#94a3b8"
            fillOpacity={0.15}
            strokeOpacity={0}
            yAxisId="left"
          />
        ))}
        {/* Full-sample ±σ filled band */}
        {stats && overlays.includes("stdDev") && (
          <ReferenceArea
            y1={stats.mean - stats.standardDeviation}
            y2={stats.mean + stats.standardDeviation}
            yAxisId="left"
            fill="#7c3aed"
            fillOpacity={0.08}
            strokeOpacity={0}
          />
        )}
        {/* Full-sample ±σ edge lines with labels */}
        {stats && overlays.includes("stdDev") && (
          <ReferenceLine
            y={stats.mean + stats.standardDeviation}
            yAxisId="left"
            stroke="#7c3aed"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: `+σ: ${formatLevel(stats.mean + stats.standardDeviation, decimals, unitShortLabel)}`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "#7c3aed",
            }}
          />
        )}
        {stats && overlays.includes("stdDev") && (
          <ReferenceLine
            y={stats.mean - stats.standardDeviation}
            yAxisId="left"
            stroke="#7c3aed"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: `-σ: ${formatLevel(stats.mean - stats.standardDeviation, decimals, unitShortLabel)}`,
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
            connectNulls
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
            connectNulls
          />
        )}
        {/* Main level line */}
        <Line
          type="monotone"
          dataKey="level"
          yAxisId="left"
          stroke="var(--color-ublue)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={true}
          animationDuration={400}
          connectNulls
        />
        {/* Second axis: transformed level */}
        {hasSecondAxis && (
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
            connectNulls
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
            connectNulls
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
            connectNulls
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
            connectNulls
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
            connectNulls
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

  const isPercent = barMode === "yoy" || barMode === "ytd";

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 10, bottom: 0, left: 0 }}
      >
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
            startIndex={brushStartIndex}
            endIndex={brushEndIndex}
            onChange={onBrushChange}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
