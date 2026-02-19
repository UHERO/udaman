"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { formatLevel } from "@catalog/utils/format";

import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  applyTransformation,
  applyTransformationMulti,
  ChangeChart,
  computeOverlays,
  computeSecondAxis,
  LevelChart,
  SERIES_COLORS,
  TRANSFORMATION_LABELS,
  type BarMode,
  type ChartRow,
  type Overlay,
  type Transformation,
} from "./analyze-chart";
import { AnalyzeDataTable } from "./analyze-data-table";

/* ------------------------------------------------------------------ */
/*  Formula tooltip helper (for non-toggle elements like buttons)      */
/* ------------------------------------------------------------------ */

function FormulaTooltip({
  formula,
  description,
  children,
}: {
  formula: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-64 space-y-1 px-3 py-2"
      >
        <div className="font-mono text-[11px] leading-relaxed">{formula}</div>
        {description && (
          <div className="text-[10px] opacity-70">{description}</div>
        )}
      </TooltipContent>
    </TooltipRoot>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle item with built-in tooltip                                  */
/*  Tooltip trigger is INSIDE the ToggleGroupItem so the item remains  */
/*  a direct child of the group — preserving first/last CSS rounding.  */
/* ------------------------------------------------------------------ */

function TooltipToggleItem({
  value,
  formula,
  description,
  className,
  children,
}: {
  value: string;
  formula: React.ReactNode;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ToggleGroupItem value={value} className={className}>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5">{children}</span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className="max-w-64 space-y-1 px-3 py-2"
        >
          <div className="font-mono text-[11px] leading-relaxed">{formula}</div>
          {description && (
            <div className="text-[10px] opacity-70">{description}</div>
          )}
        </TooltipContent>
      </TooltipRoot>
    </ToggleGroupItem>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle panel sub-components                                        */
/* ------------------------------------------------------------------ */

function ControlPanel({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-2 py-1">
        {children}
      </div>
    </TooltipProvider>
  );
}

/** Shared toggle items for Transform and 2nd Axis groups */
function TransformItems({
  indexBaseYear,
  onIndexBaseYearChange,
  minYear,
  maxYear,
  isActive,
}: {
  indexBaseYear: number;
  onIndexBaseYearChange: (year: number) => void;
  minYear: number;
  maxYear: number;
  /** Whether the "indexToYear" transform is currently selected */
  isActive: boolean;
}) {
  return (
    <>
      <ToggleGroupItem value="none" className="h-7 px-2.5 text-xs">
        None
      </ToggleGroupItem>
      <TooltipToggleItem
        value="zScore"
        className="h-7 px-2.5 text-xs"
        formula={
          <span>
            z<sub>t</sub> = (x<sub>t</sub> &minus; x̄) / &sigma;
          </span>
        }
        description="Standard score: how many std devs from the mean"
      >
        Z-Score
      </TooltipToggleItem>
      <TooltipToggleItem
        value="deviationFromTrend"
        className="h-7 px-2.5 text-xs"
        formula={
          <span>
            d<sub>t</sub> = x<sub>t</sub> &minus; (&alpha; + &beta;t)
          </span>
        }
        description="Residual from OLS linear trend"
      >
        Dev. from Trend
      </TooltipToggleItem>
      <TooltipToggleItem
        value="logLevel"
        className="h-7 px-2.5 text-xs"
        formula={
          <span>
            y<sub>t</sub> = ln(x<sub>t</sub>), x &gt; 0
          </span>
        }
        description="Natural logarithm of level values"
      >
        Log Level
      </TooltipToggleItem>
      <TooltipToggleItem
        value="indexToYear"
        className="h-7 px-2.5 text-xs"
        formula={
          <span>
            y<sub>t</sub> = (x<sub>t</sub> / x<sub>base</sub>) &times; 100
          </span>
        }
        description="Index all values relative to the first observation in the base year"
      >
        Index
        {isActive && (
          <input
            type="number"
            value={indexBaseYear}
            min={minYear}
            max={maxYear}
            onChange={(e) => {
              e.stopPropagation();
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) onIndexBaseYearChange(v);
            }}
            onClick={(e) => e.stopPropagation()}
            className="border-input bg-background ml-0.5 h-5 w-14 rounded border px-1 text-center font-mono text-[11px]"
          />
        )}
      </TooltipToggleItem>
    </>
  );
}

/** Overlays that use the rolling window parameter */
const ROLLING_OVERLAYS: Overlay[] = ["rollingMean", "rollingStdDev"];

/** Periods per year by frequency code */
const PERIODS_PER_YEAR: Record<string, number> = {
  D: 365,
  W: 52,
  M: 12,
  Q: 4,
  S: 2,
  A: 1,
};

/** Date range presets — 1Y only shown for monthly+ series */
const RANGE_PRESETS = [
  { label: "1Y", years: 1, minPPY: 12 },
  { label: "5Y", years: 5, minPPY: 0 },
  { label: "10Y", years: 10, minPPY: 0 },
  { label: "20Y", years: 20, minPPY: 0 },
  { label: "MAX", years: Infinity, minPPY: 0 },
];

/* ------------------------------------------------------------------ */
/*  URL sync helpers                                                    */
/* ------------------------------------------------------------------ */

const MANAGED_PARAMS = [
  "overlays",
  "transform",
  "secondAxis",
  "secondAxisTransform",
  "barMode",
  "rollingWindow",
  "indexYear",
  "range",
] as const;

const VALID_OVERLAYS = new Set<Overlay>([
  "rollingMean",
  "linearTrend",
  "logLinearTrend",
  "hpTrend",
  "mean",
  "stdDev",
  "rollingStdDev",
  "recessions",
]);

const VALID_TRANSFORMATIONS = new Set<Transformation>([
  "zScore",
  "deviationFromTrend",
  "logLevel",
  "indexToYear",
  "rollingMean",
  "linearTrend",
  "logLinearTrend",
  "hpTrend",
]);

const VALID_BAR_MODES = new Set<BarMode>(["yoy", "ytd", "levelChange"]);

function parseOverlays(v: string | null): Overlay[] {
  if (!v) return [];
  return v.split(",").filter((s): s is Overlay => VALID_OVERLAYS.has(s as Overlay));
}

function parseTransformation(v: string | null): Transformation | null {
  if (!v) return null;
  return VALID_TRANSFORMATIONS.has(v as Transformation) ? (v as Transformation) : null;
}

function parseBarMode(v: string | null): BarMode {
  if (!v) return "yoy";
  return VALID_BAR_MODES.has(v as BarMode) ? (v as BarMode) : "yoy";
}

function syncParamsToUrl(params: Record<string, string | undefined>) {
  const url = new URL(window.location.href);
  for (const key of MANAGED_PARAMS) url.searchParams.delete(key);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  window.history.replaceState(null, "", url.toString());
}

/** Find the start index for showing the last N years of data */
function getRangeStartIndex(chartData: ChartRow[], years: number): number {
  if (!isFinite(years) || chartData.length === 0) return 0;
  const lastDate = chartData[chartData.length - 1].date;
  const cutoff = new Date(lastDate);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (let i = 0; i < chartData.length; i++) {
    if (chartData[i].date >= cutoffStr) return i;
  }
  return 0;
}

function OverlaysToggle({
  overlays,
  onValueChange,
  disabled,
  stats,
  fmtMean,
  rollingWindow,
  onRollingWindowChange,
  freqCode,
}: {
  overlays: Overlay[];
  onValueChange: (values: string[]) => void;
  disabled: boolean;
  stats: { mean: number; median: number | null; standardDeviation: number };
  fmtMean: (v: number) => string;
  rollingWindow: number;
  onRollingWindowChange: (k: number) => void;
  freqCode?: string | null;
}) {
  const showWindowInput =
    !disabled && overlays.some((o) => ROLLING_OVERLAYS.includes(o));

  const dataPPY = PERIODS_PER_YEAR[freqCode ?? "M"] ?? 12;
  const windowPresets = [
    { label: "W", ppy: 52 },
    { label: "M", ppy: 12 },
    { label: "Q", ppy: 4 },
    { label: "S", ppy: 2 },
    { label: "A", ppy: 1 },
  ]
    .map((p) => ({ ...p, k: Math.round(dataPPY / p.ppy) }))
    .filter((p) => p.k >= 2);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground w-16 shrink-0 text-xs font-medium">
        Overlays
      </span>
      <ToggleGroup
        type="multiple"
        value={
          disabled ? ["none"] : overlays.length === 0 ? ["none"] : overlays
        }
        onValueChange={onValueChange}
        variant="default"
        size="sm"
        className="flex-wrap"
        disabled={disabled}
      >
        <ToggleGroupItem value="none" className="h-7 px-2.5 text-xs">
          None
        </ToggleGroupItem>
        <TooltipToggleItem
          value="mean"
          className="h-7 px-2.5 text-xs"
          formula={
            <span>
              x̄ = <sup>1</sup>&frasl;<sub>n</sub> &Sigma; x<sub>i</sub>
            </span>
          }
          description="Arithmetic mean of all observations"
        >
          <span className="text-muted-foreground">x̄</span>
          <span className="font-mono">{fmtMean(stats.mean)}</span>
        </TooltipToggleItem>
        <TooltipToggleItem
          value="rollingMean"
          className="h-7 px-2.5 text-xs"
          formula={
            <span>
              x̄<sub>t</sub> = <sup>1</sup>&frasl;<sub>k</sub> &Sigma;
              <sub>i=t&minus;k+1</sub>
              <sup>t</sup> x<sub>i</sub>
            </span>
          }
          description={`Backward-looking moving average (k=${rollingWindow})`}
        >
          <span className="text-muted-foreground">Rolling x̄</span>
        </TooltipToggleItem>
        <TooltipToggleItem
          value="stdDev"
          className="h-7 px-2.5 text-xs"
          formula={
            <span>
              x̄ &plusmn; &sigma; where &sigma; = &radic;(&Sigma;(x
              <sub>i</sub> &minus; x̄)&sup2; / (n&minus;1))
            </span>
          }
          description="Full-sample mean ± 1 std dev (Bessel-corrected)"
        >
          <span className="text-muted-foreground">&plusmn;&sigma;</span>
        </TooltipToggleItem>
        <TooltipToggleItem
          value="rollingStdDev"
          className="h-7 px-2.5 text-xs"
          formula={
            <span>
              x̄<sub>t</sub> &plusmn; &sigma;<sub>t</sub> where &sigma;
              <sub>t</sub> = &radic;(
              <sup>1</sup>&frasl;<sub>k&minus;1</sub> &Sigma;(x
              <sub>i</sub> &minus; x̄<sub>t</sub>)&sup2;)
            </span>
          }
          description={`Rolling mean ± 1 sample std dev (k=${rollingWindow})`}
        >
          <span className="text-muted-foreground">
            Rolling &plusmn;&sigma;
          </span>
        </TooltipToggleItem>
        <TooltipToggleItem
          value="linearTrend"
          className="h-7 px-2.5 text-xs"
          formula={
            <span>
              ŷ = &alpha; + &beta;t where &beta; = (n&Sigma;ty &minus;
              &Sigma;t&Sigma;y) / (n&Sigma;t&sup2; &minus; (&Sigma;t)&sup2;)
            </span>
          }
          description="OLS linear trend on observation index"
        >
          <span className="text-muted-foreground">Linear</span>
        </TooltipToggleItem>
        <TooltipToggleItem
          value="logLinearTrend"
          className="h-7 px-2.5 text-xs"
          formula={
            <span>
              ŷ = e<sup>&alpha; + &beta;t</sup> &mdash; regress ln(y) on t
            </span>
          }
          description="Exponential trend via log-linear regression"
        >
          <span className="text-muted-foreground">Log-Linear</span>
        </TooltipToggleItem>
        <TooltipToggleItem
          value="hpTrend"
          className="h-7 px-2.5 text-xs"
          formula={
            <span>
              min<sub>&tau;</sub> &Sigma;(y<sub>t</sub> &minus; &tau;
              <sub>t</sub>)&sup2; + &lambda;&Sigma;(&Delta;&sup2; &tau;
              <sub>t</sub>)&sup2;
            </span>
          }
          description="Hodrick-Prescott filter (&lambda; auto by frequency)"
        >
          <span className="text-muted-foreground">HP Trend</span>
        </TooltipToggleItem>
        <TooltipToggleItem
          value="recessions"
          className="h-7 px-2.5 text-xs"
          formula={<span>NBER recession shading</span>}
          description="Peak-to-trough dates from the National Bureau of Economic Research"
        >
          <span className="text-muted-foreground">Recessions</span>
        </TooltipToggleItem>
      </ToggleGroup>
      {showWindowInput && windowPresets.length > 0 && (
        <div className="ml-auto flex items-center gap-1">
          <span className="text-muted-foreground text-[10px]">k</span>
          {windowPresets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onRollingWindowChange(p.k)}
              className={`h-7 rounded-md border px-2 text-xs font-medium transition-colors ${
                rollingWindow === p.k
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground bg-transparent"
              }`}
              title={`k=${p.k}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TransformToggle({
  value,
  onValueChange,
  secondAxis,
  onSecondAxisToggle,
  secondAxisValue,
  onSecondAxisValueChange,
  indexBaseYear,
  onIndexBaseYearChange,
  minYear,
  maxYear,
}: {
  value: Transformation | null;
  onValueChange: (t: Transformation | null) => void;
  secondAxis: boolean;
  onSecondAxisToggle: () => void;
  secondAxisValue: Transformation | null;
  onSecondAxisValueChange: (t: Transformation | null) => void;
  indexBaseYear: number;
  onIndexBaseYearChange: (year: number) => void;
  minYear: number;
  maxYear: number;
}) {
  /** Enforce single-selection from a type="multiple" toggle group */
  const makeSingleHandler =
    (
      current: Transformation | null,
      setter: (t: Transformation | null) => void
    ) =>
    (values: string[]) => {
      if (values.includes("none") && current !== null) {
        setter(null);
        return;
      }
      const real = values.filter((v) => v !== "none") as Transformation[];
      if (real.length === 0) {
        setter(null);
        return;
      }
      setter(real.find((v) => v !== current) ?? real[0]);
    };

  return (
    <div className="flex flex-wrap justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-16 shrink-0 text-xs font-medium">
          Transform
        </span>
        <ToggleGroup
          type="multiple"
          value={value ? [value] : ["none"]}
          onValueChange={makeSingleHandler(value, onValueChange)}
          variant="default"
          size="sm"
        >
          <TransformItems
            indexBaseYear={indexBaseYear}
            onIndexBaseYearChange={onIndexBaseYearChange}
            minYear={minYear}
            maxYear={maxYear}
            isActive={value === "indexToYear"}
          />
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {secondAxis && (
          <ToggleGroup
            type="multiple"
            value={secondAxisValue ? [secondAxisValue] : ["none"]}
            onValueChange={makeSingleHandler(
              secondAxisValue,
              onSecondAxisValueChange
            )}
            variant="default"
            size="sm"
          >
            <ToggleGroupItem value="none" className="h-7 px-2.5 text-xs">
              None
            </ToggleGroupItem>
            <TooltipToggleItem
              value="zScore"
              className="h-7 px-2.5 text-xs"
              formula={
                <span>
                  z<sub>t</sub> = (x<sub>t</sub> &minus; x̄) / &sigma;
                </span>
              }
              description="Standard score: how many std devs from the mean"
            >
              Z-Score
            </TooltipToggleItem>
            <TooltipToggleItem
              value="deviationFromTrend"
              className="h-7 px-2.5 text-xs"
              formula={
                <span>
                  d<sub>t</sub> = x<sub>t</sub> &minus; (&alpha; + &beta;t)
                </span>
              }
              description="Residual from OLS linear trend"
            >
              Dev. from Trend
            </TooltipToggleItem>
            <TooltipToggleItem
              value="logLevel"
              className="h-7 px-2.5 text-xs"
              formula={
                <span>
                  y<sub>t</sub> = ln(x<sub>t</sub>), x &gt; 0
                </span>
              }
              description="Natural logarithm of level values"
            >
              Log Level
            </TooltipToggleItem>
            <TooltipToggleItem
              value="indexToYear"
              className="h-7 px-2.5 text-xs"
              formula={
                <span>
                  y<sub>t</sub> = (x<sub>t</sub> / x<sub>base</sub>) &times;
                  100
                </span>
              }
              description="Index all values relative to the first observation in the base year"
            >
              Index
              {secondAxisValue === "indexToYear" && (
                <input
                  type="number"
                  value={indexBaseYear}
                  min={minYear}
                  max={maxYear}
                  onChange={(e) => {
                    e.stopPropagation();
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) onIndexBaseYearChange(v);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="border-input bg-background ml-0.5 h-5 w-14 rounded border px-1 text-center font-mono text-[11px]"
                />
              )}
            </TooltipToggleItem>
          </ToggleGroup>
        )}
        <div className="ml-auto">
          <FormulaTooltip
            formula={
              <span>Plot a second transformation on a right Y-axis</span>
            }
            description="Disables overlays when active"
          >
            <button
              type="button"
              onClick={onSecondAxisToggle}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                secondAxis
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground bg-transparent"
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="20" x2="18" y2="4" />
                <polyline points="14 8 18 4 22 8" />
                <line x1="6" y1="4" x2="6" y2="20" />
                <polyline points="10 16 6 20 2 16" />
              </svg>
              2nd Axis
            </button>
          </FormulaTooltip>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main controls component                                            */
/* ------------------------------------------------------------------ */

interface AnalyzeControlsProps {
  data: [string, number][];
  yoy: [string, number][];
  ytd: [string, number][];
  levelChange: [string, number][];
  decimals: number;
  unitLabel?: string | null;
  unitShortLabel?: string | null;
  currentFreqCode?: string | null;
  /** Multi-series compare mode */
  compareSeries?: Array<{ name: string; data: [string, number][]; unitShortLabel?: string | null }>;
  /** Series name → ID map for linking to detail pages (compare mode) */
  seriesLinks?: Record<string, number>;
  /** Universe slug for building URLs (compare mode) */
  universe?: string;
}

export function AnalyzeControls({
  data,
  yoy,
  ytd,
  levelChange,
  decimals,
  unitLabel,
  unitShortLabel,
  currentFreqCode,
  compareSeries: compareSeriesData,
  seriesLinks,
  universe,
}: AnalyzeControlsProps) {
  const isCompareMode = !!(compareSeriesData && compareSeriesData.length >= 1);
  const router = useRouter();

  const searchParams = useSearchParams();

  const [hiddenSeries, setHiddenSeries] = useState<Set<number>>(new Set());

  const [barMode, setBarMode] = useState<BarMode>(
    () => parseBarMode(searchParams.get("barMode"))
  );
  const [overlays, setOverlays] = useState<Overlay[]>(
    () => parseOverlays(searchParams.get("overlays"))
  );
  const [transformation, setTransformation] = useState<Transformation | null>(
    () => parseTransformation(searchParams.get("transform"))
  );
  const [secondAxis, setSecondAxis] = useState(
    () => searchParams.get("secondAxis") === "1"
  );
  const [secondAxisTransformation, setSecondAxisTransformation] =
    useState<Transformation | null>(
      () => parseTransformation(searchParams.get("secondAxisTransform"))
    );
  const [rollingWindow, setRollingWindow] = useState(() => {
    const v = parseInt(searchParams.get("rollingWindow") ?? "", 10);
    return !isNaN(v) && v >= 2 ? v : 12;
  });
  const [indexBaseYear, setIndexBaseYear] = useState(() => {
    const v = parseInt(searchParams.get("indexYear") ?? "", 10);
    return !isNaN(v) ? v : 2015;
  });

  // When second axis is on, overlays are disabled
  const effectiveOverlays = useMemo(
    () => (secondAxis ? [] : overlays),
    [secondAxis, overlays]
  );

  // ── Compare mode: merge all series into unified chart rows ─────────
  const compareChartData = useMemo(() => {
    if (!isCompareMode) return [];
    const dateSet = new Map<string, ChartRow>();
    for (let s = 0; s < compareSeriesData.length; s++) {
      for (const [date, value] of compareSeriesData[s].data) {
        if (!dateSet.has(date)) {
          dateSet.set(date, {
            date,
            level: null,
            levelChange: null,
            yoy: null,
            ytd: null,
          });
        }
        const row = dateSet.get(date)!;
        (row as unknown as Record<string, unknown>)[`series_${s}`] = value;
      }
    }
    return [...dateSet.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [isCompareMode, compareSeriesData]);

  const compareSeriesNames = useMemo(
    () => (isCompareMode ? compareSeriesData.map((s) => s.name) : []),
    [isCompareMode, compareSeriesData]
  );

  /** Group series indices by unit label for the compare stats bar */
  const compareUnits = useMemo(() => {
    if (!isCompareMode) return [];
    const map = new Map<string, number[]>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      const label = compareSeriesData[i].unitShortLabel ?? "—";
      const indices = map.get(label);
      if (indices) indices.push(i);
      else map.set(label, [i]);
    }
    return [...map.entries()]; // [label, seriesIndices[]]
  }, [isCompareMode, compareSeriesData]);

  // ── Standard single-series chart data ──────────────────────────────
  const chartData = useMemo(() => {
    if (isCompareMode) return compareChartData;
    const map = new Map<string, ChartRow>();
    for (const [date, value] of data) {
      map.set(date, {
        date,
        level: value,
        levelChange: null,
        yoy: null,
        ytd: null,
      });
    }
    for (const [date, value] of levelChange) {
      const existing = map.get(date);
      if (existing) existing.levelChange = value;
    }
    for (const [date, value] of yoy) {
      const existing = map.get(date);
      if (existing) existing.yoy = value;
    }
    for (const [date, value] of ytd) {
      const existing = map.get(date);
      if (existing) existing.ytd = value;
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [isCompareMode, compareChartData, data, yoy, ytd, levelChange]);

  const endIdx = Math.max(0, chartData.length - 1);
  const [rangePreset, setRangePreset] = useState(() => {
    const v = searchParams.get("range");
    if (v) {
      const preset = RANGE_PRESETS.find((p) => p.label === v);
      if (preset) return v;
    }
    return "10Y";
  });
  const [brushRange, setBrushRange] = useState<{
    startIndex: number;
    endIndex: number;
  }>(() => {
    const rangeParam = searchParams.get("range");
    if (rangeParam) {
      const preset = RANGE_PRESETS.find((p) => p.label === rangeParam);
      if (preset) {
        return { startIndex: getRangeStartIndex(chartData, preset.years), endIndex: endIdx };
      }
    }
    return { startIndex: getRangeStartIndex(chartData, 10), endIndex: endIdx };
  });

  const handlePresetClick = useCallback(
    (years: number, label: string) => {
      const startIndex = getRangeStartIndex(chartData, years);
      setBrushRange({ startIndex, endIndex: endIdx });
      setRangePreset(label);
    },
    [chartData, endIdx]
  );

  const brushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBrushChange = useCallback(
    (range: { startIndex?: number; endIndex?: number }) => {
      if (brushTimer.current) clearTimeout(brushTimer.current);
      brushTimer.current = setTimeout(() => {
        setRangePreset("");
        setBrushRange((prev) => ({
          startIndex: range.startIndex ?? prev.startIndex,
          endIndex: range.endIndex ?? prev.endIndex,
        }));
      }, 120);
    },
    []
  );

  // ── Sync chart state → URL search params ────────────────────────────
  useEffect(() => {
    syncParamsToUrl({
      overlays: overlays.length > 0 ? overlays.join(",") : undefined,
      transform: transformation ?? undefined,
      secondAxis: secondAxis ? "1" : undefined,
      secondAxisTransform: secondAxis ? (secondAxisTransformation ?? undefined) : undefined,
      barMode: barMode !== "yoy" ? barMode : undefined,
      rollingWindow: rollingWindow !== 12 ? String(rollingWindow) : undefined,
      indexYear: indexBaseYear !== 2015 ? String(indexBaseYear) : undefined,
      range: rangePreset && rangePreset !== "10Y" ? rangePreset : undefined,
    });
  }, [overlays, transformation, secondAxis, secondAxisTransformation, barMode, rollingWindow, indexBaseYear, rangePreset]);

  // ── Min/max year from brush-selected date range ─────────────────────
  const { minYear, maxYear } = useMemo(() => {
    if (chartData.length === 0) return { minYear: 2000, maxYear: 2030 };
    const startDate = chartData[brushRange.startIndex]?.date ?? chartData[0].date;
    const endDate = chartData[brushRange.endIndex]?.date ?? chartData[chartData.length - 1].date;
    return {
      minYear: parseInt(startDate.slice(0, 4), 10),
      maxYear: parseInt(endDate.slice(0, 4), 10),
    };
  }, [chartData, brushRange]);

  // ── Compare mode: full data with transforms (for chart + brush) ────
  const compareFullData = useMemo(() => {
    if (!isCompareMode) return [];
    return applyTransformationMulti(chartData, transformation, compareSeriesNames.length, indexBaseYear, rollingWindow);
  }, [isCompareMode, chartData, transformation, compareSeriesNames.length, indexBaseYear, rollingWindow]);

  // ── Compare mode: sliced data with transforms (for table) ──────────
  const compareVisibleData = useMemo(() => {
    if (!isCompareMode) return [];
    return compareFullData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1
    );
  }, [isCompareMode, compareFullData, brushRange]);

  // Visible data for the chart (brush-filtered, with transforms applied)
  const visibleData = useMemo(() => {
    if (isCompareMode) return compareVisibleData;
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1
    );
    let result = sliced;
    // Compute second axis transform first (reads original level)
    if (secondAxis && secondAxisTransformation) {
      result = computeSecondAxis(result, secondAxisTransformation, indexBaseYear);
    }
    // Apply main transformation (replaces level)
    result = applyTransformation(result, transformation, indexBaseYear);
    return result;
  }, [
    isCompareMode,
    compareVisibleData,
    chartData,
    brushRange,
    transformation,
    secondAxis,
    secondAxisTransformation,
    indexBaseYear,
  ]);

  // ── Compare mode: table data preserving original levels ─────────────
  const compareTableData = useMemo(() => {
    if (!isCompareMode) return [];
    const sliced = chartData.slice(brushRange.startIndex, brushRange.endIndex + 1);
    if (!transformation) return sliced;
    const transformed = applyTransformationMulti(
      sliced, transformation, compareSeriesNames.length, indexBaseYear, rollingWindow
    );
    return sliced.map((row, i) => {
      const result = { ...row };
      for (let s = 0; s < compareSeriesNames.length; s++) {
        const sKey = `series_${s}` as const;
        (result as unknown as Record<string, unknown>)[`transformed_${s}`] =
          transformed[i][sKey];
      }
      return result;
    });
  }, [isCompareMode, chartData, brushRange, transformation, compareSeriesNames.length, indexBaseYear, rollingWindow]);

  // Table data — filtered to brush range, with overlays; transforms stored separately
  const tableData = useMemo(() => {
    if (isCompareMode) return compareTableData;
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1
    );
    let rows = computeOverlays(sliced, effectiveOverlays, rollingWindow);
    if (secondAxis && secondAxisTransformation) {
      rows = computeSecondAxis(rows, secondAxisTransformation, indexBaseYear);
    }
    if (transformation) {
      const transformed = applyTransformation(rows, transformation, indexBaseYear);
      rows = rows.map((row, i) => ({
        ...row,
        mainTransformed: transformed[i].level,
      }));
    }
    return rows;
  }, [
    isCompareMode,
    compareTableData,
    chartData,
    brushRange,
    effectiveOverlays,
    rollingWindow,
    transformation,
    secondAxis,
    secondAxisTransformation,
    indexBaseYear,
  ]);

  // Overlay toggle handler: clicking "none" clears all; clicking an overlay removes "none"
  const handleOverlayChange = useCallback(
    (values: string[]) => {
      // User just clicked "none" (it wasn't in the previous selection)
      if (values.includes("none") && overlays.length > 0) {
        setOverlays([]);
        return;
      }
      // Otherwise strip "none" and keep the real overlay values
      setOverlays(values.filter((v) => v !== "none") as Overlay[]);
    },
    [overlays]
  );

  // Summary stats for the brush-selected range (first series in compare mode)
  const rangeStats = useMemo(() => {
    const sliced = chartData.slice(brushRange.startIndex, brushRange.endIndex + 1);
    let levels: number[];
    if (isCompareMode) {
      levels = sliced
        .map((r) => r.series_0)
        .filter((v): v is number => v != null && !isNaN(v));
    } else {
      levels = sliced
        .map((r) => r.level)
        .filter((v): v is number => v != null);
    }
    if (levels.length === 0) return null;
    const n = levels.length;
    const mean = levels.reduce((a, b) => a + b, 0) / n;
    const sorted = [...levels].sort((a, b) => a - b);
    const median =
      n % 2 === 1
        ? sorted[Math.floor(n / 2)]
        : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    let sumSq = 0;
    for (const v of levels) sumSq += (v - mean) ** 2;
    const stdDev = n > 1 ? Math.sqrt(sumSq / (n - 1)) : 0;
    return { mean, median, stdDev, n };
  }, [chartData, brushRange, isCompareMode]);

  // Stats in the shape expected by OverlaysToggle and LevelChart, derived from selected range
  const chartStats = useMemo(
    () =>
      rangeStats
        ? { mean: rangeStats.mean, median: rangeStats.median, standardDeviation: rangeStats.stdDev }
        : null,
    [rangeStats]
  );

  const fmt = (v: number) => formatLevel(v, decimals, unitShortLabel);

  // ── Compare mode: simplified transform-only toggle ─────────────────
  const makeTransformHandler =
    (
      current: Transformation | null,
      setter: (t: Transformation | null) => void
    ) =>
    (values: string[]) => {
      if (values.includes("none") && current !== null) {
        setter(null);
        return;
      }
      const real = values.filter((v) => v !== "none") as Transformation[];
      if (real.length === 0) {
        setter(null);
        return;
      }
      setter(real.find((v) => v !== current) ?? real[0]);
    };

  // ── Compare mode render ────────────────────────────────────────────
  if (isCompareMode) {
    return (
      <div className="flex flex-col gap-3">
        {/* Stats & range bar */}
        <div className="flex items-start gap-6 py-1">
          <div className="flex gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-[10px]">
                Mean ({compareSeriesNames[0]})
              </span>
              <span className="font-mono text-sm font-medium">
                {rangeStats ? fmt(rangeStats.mean) : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-[10px]">Median</span>
              <span className="font-mono text-sm font-medium">
                {rangeStats ? fmt(rangeStats.median) : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-[10px]">Std Dev</span>
              <span className="font-mono text-sm font-medium">
                {rangeStats ? fmt(rangeStats.stdDev) : "—"}
              </span>
            </div>
          </div>
          <Separator orientation="vertical" className="h-auto self-stretch" />
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Range</span>
            <div className="flex gap-1">
              {RANGE_PRESETS.filter(
                (p) =>
                  p.minPPY <= (PERIODS_PER_YEAR[currentFreqCode ?? "M"] ?? 12)
              ).map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePresetClick(p.years, p.label)}
                  className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                    rangePreset === p.label
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground bg-transparent"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Separator orientation="vertical" className="h-auto self-stretch" />
          {/* Units for compared series */}
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Units</span>
            <div className="flex flex-wrap gap-2">
              {compareUnits.map(([label, indices]) => (
                <span key={label} className="flex items-center gap-1 text-sm font-medium">
                  {compareUnits.length > 1 &&
                    indices.map((i) => (
                      <span
                        key={i}
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                      />
                    ))}
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* Transform only (no overlays, no 2nd axis) */}
        <ControlPanel>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground w-16 shrink-0 text-xs font-medium">
              Transform
            </span>
            <ToggleGroup
              type="multiple"
              value={transformation ? [transformation] : ["none"]}
              onValueChange={makeTransformHandler(transformation, setTransformation)}
              variant="default"
              size="sm"
              className="flex-wrap"
            >
              <TransformItems
                indexBaseYear={indexBaseYear}
                onIndexBaseYearChange={setIndexBaseYear}
                minYear={minYear}
                maxYear={maxYear}
                isActive={transformation === "indexToYear"}
              />
              <TooltipToggleItem
                value="rollingMean"
                className="h-7 px-2.5 text-xs"
                formula={
                  <span>
                    x̄<sub>t</sub> = <sup>1</sup>&frasl;<sub>k</sub> &Sigma;
                    <sub>i=t&minus;k+1</sub>
                    <sup>t</sup> x<sub>i</sub>
                  </span>
                }
                description={`Backward-looking moving average (k=${rollingWindow})`}
              >
                Rolling x̄
              </TooltipToggleItem>
              <TooltipToggleItem
                value="linearTrend"
                className="h-7 px-2.5 text-xs"
                formula={
                  <span>
                    ŷ = &alpha; + &beta;t
                  </span>
                }
                description="OLS linear trend on observation index"
              >
                Linear
              </TooltipToggleItem>
              <TooltipToggleItem
                value="logLinearTrend"
                className="h-7 px-2.5 text-xs"
                formula={
                  <span>
                    ŷ = e<sup>&alpha; + &beta;t</sup>
                  </span>
                }
                description="Exponential trend via log-linear regression"
              >
                Log-Linear
              </TooltipToggleItem>
              <TooltipToggleItem
                value="hpTrend"
                className="h-7 px-2.5 text-xs"
                formula={
                  <span>
                    min<sub>&tau;</sub> &Sigma;(y<sub>t</sub> &minus; &tau;
                    <sub>t</sub>)&sup2; + &lambda;&Sigma;(&Delta;&sup2; &tau;
                    <sub>t</sub>)&sup2;
                  </span>
                }
                description="Hodrick-Prescott filter (λ auto by frequency)"
              >
                HP Trend
              </TooltipToggleItem>
            </ToggleGroup>
            {transformation === "rollingMean" && (() => {
              const dataPPY = PERIODS_PER_YEAR[currentFreqCode ?? "M"] ?? 12;
              const windowPresets = [
                { label: "W", ppy: 52 },
                { label: "M", ppy: 12 },
                { label: "Q", ppy: 4 },
                { label: "S", ppy: 2 },
                { label: "A", ppy: 1 },
              ]
                .map((p) => ({ ...p, k: Math.round(dataPPY / p.ppy) }))
                .filter((p) => p.k >= 2);
              return windowPresets.length > 0 ? (
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-muted-foreground text-[10px]">k</span>
                  {windowPresets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setRollingWindow(p.k)}
                      className={`h-7 rounded-md border px-2 text-xs font-medium transition-colors ${
                        rollingWindow === p.k
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground bg-transparent"
                      }`}
                      title={`k=${p.k}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
        </ControlPanel>

        {/* Multi-series level chart with brush */}
        <div className="w-full py-2">
          <LevelChart
            data={compareFullData}
            decimals={decimals}
            freqCode={currentFreqCode}
            seriesNames={compareSeriesNames}
            hiddenSeries={hiddenSeries}
            brushStartIndex={brushRange.startIndex}
            brushEndIndex={brushRange.endIndex}
            onBrushChange={handleBrushChange}
            indexBaseYear={transformation === "indexToYear" ? indexBaseYear : undefined}
          />
        </div>

        {/* Interactive legend: click name to toggle, X to remove */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {compareSeriesNames.map((name, i) => {
            const isHidden = hiddenSeries.has(i);
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            const seriesId = seriesLinks?.[name];
            return (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 font-mono text-xs"
              >
                <button
                  type="button"
                  onClick={() => {
                    setHiddenSeries((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    });
                  }}
                  className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{ opacity: isHidden ? 0.35 : 1 }}
                  title={isHidden ? `Show ${name}` : `Hide ${name}`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {seriesId ? (
                    <a
                      href={`/udaman/${universe}/series/${seriesId}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {name}
                    </a>
                  ) : (
                    name
                  )}
                </button>
                {universe && compareSeriesNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = compareSeriesNames.filter(
                        (n) => n !== name,
                      );
                      const expr = remaining.join(",");
                      router.push(
                        `/udaman/${universe}/series/compare?names=${encodeURIComponent(expr)}`,
                      );
                    }}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>

        <Separator />

        {/* Multi-series data table */}
        <AnalyzeDataTable
          rows={tableData}
          decimals={decimals}
          unitShortLabel={unitShortLabel}
          seriesNames={compareSeriesNames}
          activeTransformation={transformation}
        />
      </div>
    );
  }

  // ── Standard single-series render ──────────────────────────────────

  return (
    <div className="space-y-3">
      {/* FRED-style control bar */}
      <div className="flex items-start gap-6 py-1">
        {/* Col 1: Summary stats for selected range */}
        <div className="flex gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-[10px]">Mean</span>
            <span className="font-mono text-sm font-medium">
              {rangeStats ? fmt(rangeStats.mean) : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-[10px]">Median</span>
            <span className="font-mono text-sm font-medium">
              {rangeStats ? fmt(rangeStats.median) : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-[10px]">Std Dev</span>
            <span className="font-mono text-sm font-medium">
              {rangeStats ? fmt(rangeStats.stdDev) : "—"}
            </span>
          </div>
        </div>
        <Separator orientation="vertical" className="h-auto self-stretch" />

        {/* Col 2: Range presets */}
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Range</span>
          <div className="flex gap-1">
            {RANGE_PRESETS.filter(
              (p) =>
                p.minPPY <= (PERIODS_PER_YEAR[currentFreqCode ?? "M"] ?? 12)
            ).map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePresetClick(p.years, p.label)}
                className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                  rangePreset === p.label
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground bg-transparent"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <Separator orientation="vertical" className="h-auto self-stretch" />

        {/* Col 3: Units */}
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Units</span>
          <span className="text-sm font-medium">{unitLabel || "—"}</span>
        </div>
      </div>

      <Separator />

      {/* Overlays & Transforms toggle groups */}
      {chartStats && (
        <ControlPanel>
          <OverlaysToggle
            overlays={overlays}
            onValueChange={handleOverlayChange}
            disabled={secondAxis}
            stats={chartStats}
            fmtMean={fmt}
            rollingWindow={rollingWindow}
            onRollingWindowChange={setRollingWindow}
            freqCode={currentFreqCode}
          />
          <TransformToggle
            value={transformation}
            onValueChange={setTransformation}
            secondAxis={secondAxis}
            onSecondAxisToggle={() => setSecondAxis((v) => !v)}
            secondAxisValue={secondAxisTransformation}
            onSecondAxisValueChange={setSecondAxisTransformation}
            indexBaseYear={indexBaseYear}
            onIndexBaseYearChange={setIndexBaseYear}
            minYear={minYear}
            maxYear={maxYear}
          />
        </ControlPanel>
      )}

      {/* Level line chart */}
      <div className="w-full py-2">
        <LevelChart
          data={visibleData}
          decimals={decimals}
          stats={chartStats ?? undefined}
          overlays={effectiveOverlays}
          unitShortLabel={unitShortLabel}
          secondAxis={secondAxis}
          transformationLabel={
            secondAxisTransformation
              ? TRANSFORMATION_LABELS[secondAxisTransformation]
              : undefined
          }
          freqCode={currentFreqCode}
          rollingWindow={rollingWindow}
          indexBaseYear={
            transformation === "indexToYear" || secondAxisTransformation === "indexToYear"
              ? indexBaseYear
              : undefined
          }
        />
      </div>

      <Separator />

      {/* Bar chart with mode toggle */}
      <div className="w-full py-2">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-muted-foreground w-16 shrink-0 text-xs font-medium">
            Changes
          </span>
          <ToggleGroup
            type="single"
            value={barMode}
            onValueChange={(v) => {
              if (v) setBarMode(v as BarMode);
            }}
            variant="default"
            size="sm"
          >
            <ToggleGroupItem value="yoy" className="h-7 px-2.5 text-xs">
              YOY %
            </ToggleGroupItem>
            <ToggleGroupItem value="ytd" className="h-7 px-2.5 text-xs">
              YTD %
            </ToggleGroupItem>
            <ToggleGroupItem value="levelChange" className="h-7 px-2.5 text-xs">
              LVL Chg
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ChangeChart
          data={chartData}
          decimals={decimals}
          barMode={barMode}
          unitShortLabel={unitShortLabel}
          brushStartIndex={brushRange.startIndex}
          brushEndIndex={brushRange.endIndex}
          onBrushChange={handleBrushChange}
          freqCode={currentFreqCode}
        />
      </div>

      <Separator />

      {/* Data table — shares overlay/transform state with charts */}
      <AnalyzeDataTable
        rows={tableData}
        decimals={decimals}
        unitShortLabel={unitShortLabel}
        activeOverlays={effectiveOverlays}
        activeTransformation={transformation}
        secondAxis={secondAxis}
        secondAxisTransformation={secondAxisTransformation}
      />
    </div>
  );
}
