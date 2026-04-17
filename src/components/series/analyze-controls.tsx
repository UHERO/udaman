"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatLevel } from "@catalog/utils/format";
import { formatEventType } from "@catalog/models/timeline-event";
import { AlertTriangle, ArrowRightLeft, Calendar, X } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  type TimelineEventForChart,
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
      <div className="flex flex-col gap-2 py-1">{children}</div>
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
  showChangeTransforms = true,
}: {
  indexBaseYear: number;
  onIndexBaseYearChange: (year: number) => void;
  minYear: number;
  maxYear: number;
  /** Whether the "indexToYear" transform is currently selected */
  isActive: boolean;
  /** Show YOY/YTD/PoP/LVL Chg items (hidden in compare mode) */
  showChangeTransforms?: boolean;
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
      {showChangeTransforms && (
        <>
          <TooltipToggleItem
            value="yoy"
            className="h-7 px-2.5 text-xs"
            formula={
              <span>
                (x<sub>t</sub> &minus; x<sub>t&minus;4</sub>) / x<sub>t&minus;4</sub> &times; 100
              </span>
            }
            description="Year-over-year percent change"
          >
            YOY %
          </TooltipToggleItem>
          <TooltipToggleItem
            value="ytd"
            className="h-7 px-2.5 text-xs"
            formula={
              <span>
                (x<sub>t</sub> &minus; x<sub>Jan</sub>) / x<sub>Jan</sub> &times; 100
              </span>
            }
            description="Year-to-date percent change from first period of year"
          >
            YTD %
          </TooltipToggleItem>
          <TooltipToggleItem
            value="pop"
            className="h-7 px-2.5 text-xs"
            formula={
              <span>
                (x<sub>t</sub> &minus; x<sub>t&minus;1</sub>) / x<sub>t&minus;1</sub> &times; 100
              </span>
            }
            description="Period-over-period percent change"
          >
            PoP %
          </TooltipToggleItem>
          <TooltipToggleItem
            value="levelChange"
            className="h-7 px-2.5 text-xs"
            formula={
              <span>
                &Delta;x<sub>t</sub> = x<sub>t</sub> &minus; x<sub>t&minus;1</sub>
              </span>
            }
            description="Absolute change from previous period"
          >
            LVL Chg
          </TooltipToggleItem>
        </>
      )}
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
  "events",
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
  "yoy",
  "ytd",
  "pop",
  "levelChange",
]);

const VALID_BAR_MODES = new Set<BarMode>(["yoy", "ytd", "levelChange", "pop"]);

function parseOverlays(v: string | null): Overlay[] {
  if (!v) return [];
  return v
    .split(",")
    .filter((s): s is Overlay => VALID_OVERLAYS.has(s as Overlay));
}

/** Parse selected event types from URL */
function parseEventTypes(v: string | null): Set<string> {
  if (!v) return new Set();
  return new Set(v.split(",").filter(Boolean));
}

function parseTransformation(v: string | null): Transformation | null {
  if (!v) return null;
  return VALID_TRANSFORMATIONS.has(v as Transformation)
    ? (v as Transformation)
    : null;
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

/** Standalone Timeline popover — select event types to overlay on charts */
function TimelinePopover({
  timelineEvents,
  selectedEventTypes,
  onSelectedEventTypesChange,
}: {
  timelineEvents: TimelineEventForChart[];
  selectedEventTypes: Set<string>;
  onSelectedEventTypesChange: (types: Set<string>) => void;
}) {
  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of timelineEvents) {
      map.set(e.eventType, (map.get(e.eventType) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [timelineEvents]);

  const toggleType = useCallback(
    (type: string) => {
      const next = new Set(selectedEventTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      onSelectedEventTypesChange(next);
    },
    [selectedEventTypes, onSelectedEventTypesChange],
  );

  if (timelineEvents.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
            selectedEventTypes.size > 0
              ? "border-slate-400 bg-slate-100 text-slate-700"
              : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground bg-transparent"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          Timeline
          {selectedEventTypes.size > 0 && (
            <span className="rounded-full bg-slate-500 px-1.5 text-[10px] leading-4 text-white">
              {selectedEventTypes.size}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="max-h-64 space-y-0.5 overflow-y-auto p-2">
          {typeCounts.map(([type, count]) => (
            <button
              key={type}
              type="button"
              className="hover:bg-accent flex w-full items-center gap-2 rounded px-1 py-1.5 text-xs"
              onClick={() => toggleType(type)}
            >
              <Checkbox
                checked={selectedEventTypes.has(type)}
                className="h-3.5 w-3.5"
                tabIndex={-1}
              />
              <span>{formatEventType(type)}</span>
              <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                {count}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
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
  children,
}: {
  overlays: Overlay[];
  onValueChange: (values: string[]) => void;
  disabled: boolean;
  stats: { mean: number; median: number | null; standardDeviation: number };
  fmtMean: (v: number) => string;
  rollingWindow: number;
  onRollingWindowChange: (k: number) => void;
  freqCode?: string | null;
  children?: React.ReactNode;
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
          <span className="text-muted-foreground">Rolling &plusmn;&sigma;</span>
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
      </ToggleGroup>
      {children}
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
      setter: (t: Transformation | null) => void,
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
              onSecondAxisValueChange,
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
                  y<sub>t</sub> = (x<sub>t</sub> / x<sub>base</sub>) &times; 100
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
            <TooltipToggleItem
              value="yoy"
              className="h-7 px-2.5 text-xs"
              formula={
                <span>
                  (x<sub>t</sub> &minus; x<sub>t&minus;4</sub>) / x<sub>t&minus;4</sub> &times; 100
                </span>
              }
              description="Year-over-year percent change"
            >
              YOY %
            </TooltipToggleItem>
            <TooltipToggleItem
              value="ytd"
              className="h-7 px-2.5 text-xs"
              formula={
                <span>
                  (x<sub>t</sub> &minus; x<sub>Jan</sub>) / x<sub>Jan</sub> &times; 100
                </span>
              }
              description="Year-to-date percent change from first period of year"
            >
              YTD %
            </TooltipToggleItem>
            <TooltipToggleItem
              value="pop"
              className="h-7 px-2.5 text-xs"
              formula={
                <span>
                  (x<sub>t</sub> &minus; x<sub>t&minus;1</sub>) / x<sub>t&minus;1</sub> &times; 100
                </span>
              }
              description="Period-over-period percent change"
            >
              PoP %
            </TooltipToggleItem>
            <TooltipToggleItem
              value="levelChange"
              className="h-7 px-2.5 text-xs"
              formula={
                <span>
                  &Delta;x<sub>t</sub> = x<sub>t</sub> &minus; x<sub>t&minus;1</sub>
                </span>
              }
              description="Absolute change from previous period"
            >
              LVL Chg
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
  pop?: [string, number][];
  decimals: number;
  unitLabel?: string | null;
  unitShortLabel?: string | null;
  currentFreqCode?: string | null;
  /** Multi-series compare mode */
  compareSeries?: Array<{
    name: string;
    data: [string, number][];
    unitShortLabel?: string | null;
  }>;
  /** Series name → ID map for linking to detail pages (compare mode) */
  seriesLinks?: Record<string, number>;
  /** Universe slug for building URLs (compare mode) */
  universe?: string;
  /** Timeline events for chart overlays */
  timelineEvents?: TimelineEventForChart[];
}

export function AnalyzeControls({
  data,
  yoy,
  ytd,
  levelChange,
  pop: popData,
  decimals,
  unitLabel,
  unitShortLabel,
  currentFreqCode,
  compareSeries: compareSeriesData,
  seriesLinks,
  universe,
  timelineEvents = [],
}: AnalyzeControlsProps) {
  const isCompareMode = !!(compareSeriesData && compareSeriesData.length >= 1);
  const router = useRouter();

  const searchParams = useSearchParams();

  // 3-state visibility: absent = colored (default), "gray" = muted, "hidden" = not rendered
  const [seriesVisibility, setSeriesVisibility] = useState<
    Map<number, "gray" | "hidden">
  >(new Map());

  const cycleVisibility = useCallback((index: number) => {
    setSeriesVisibility((prev) => {
      const next = new Map(prev);
      const current = prev.get(index);
      if (!current) next.set(index, "gray"); // colored → gray
      else if (current === "gray") next.set(index, "hidden"); // gray → hidden
      else next.delete(index); // hidden → colored
      return next;
    });
  }, []);

  const [barMode, setBarMode] = useState<BarMode>(() =>
    parseBarMode(searchParams.get("barMode")),
  );
  const [overlays, setOverlays] = useState<Overlay[]>(() =>
    parseOverlays(searchParams.get("overlays")),
  );
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<string>>(
    () => parseEventTypes(searchParams.get("events")),
  );
  const [transformation, setTransformation] = useState<Transformation | null>(
    () => parseTransformation(searchParams.get("transform")),
  );
  const [secondAxis, setSecondAxis] = useState(
    () => searchParams.get("secondAxis") === "1",
  );
  const [secondAxisTransformation, setSecondAxisTransformation] =
    useState<Transformation | null>(() =>
      parseTransformation(searchParams.get("secondAxisTransform")),
    );
  const [rollingWindow, setRollingWindow] = useState(() => {
    const v = parseInt(searchParams.get("rollingWindow") ?? "", 10);
    return !isNaN(v) && v >= 2 ? v : 12;
  });
  const [indexBaseYear, setIndexBaseYear] = useState(() => {
    const v = parseInt(searchParams.get("indexYear") ?? "", 10);
    return !isNaN(v) ? v : 2015;
  });

  // Selected events filtered from all timeline events by type
  const selectedEvents = useMemo(
    () => timelineEvents.filter((e) => selectedEventTypes.has(e.eventType)),
    [timelineEvents, selectedEventTypes],
  );

  // When second axis is on, overlays are disabled
  const effectiveOverlays = useMemo(
    () => (secondAxis ? [] : overlays),
    [secondAxis, overlays],
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
            pop: null,
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
    [isCompareMode, compareSeriesData],
  );

  /** Group visible (non-hidden) series indices by unit label for the compare stats bar */
  const compareUnits = useMemo(() => {
    if (!isCompareMode) return [];
    const map = new Map<string, number[]>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      const label = compareSeriesData[i].unitShortLabel ?? "—";
      const indices = map.get(label);
      if (indices) indices.push(i);
      else map.set(label, [i]);
    }
    return [...map.entries()]; // [label, seriesIndices[]]
  }, [isCompareMode, compareSeriesData, seriesVisibility]);

  /** User overrides for axis assignment (index → "left" | "right").
   *  Absent entries use the auto-default from unit groups. */
  const [axisOverrides, setAxisOverrides] = useState<
    Map<number, "left" | "right">
  >(new Map());

  /** Auto-default axis assignment based on unit groups */
  const autoAxisMap = useMemo(() => {
    const map = new Map<number, "left" | "right">();
    if (!isCompareMode) return map;
    if (compareUnits.length === 2) {
      for (const idx of compareUnits[0][1]) map.set(idx, "left");
      for (const idx of compareUnits[1][1]) map.set(idx, "right");
    } else {
      for (const [, indices] of compareUnits) {
        for (const idx of indices) map.set(idx, "left");
      }
    }
    return map;
  }, [isCompareMode, compareUnits]);

  /** Merged axis map: user overrides take precedence over auto-defaults */
  const seriesAxisMap = useMemo(() => {
    const map = new Map(autoAxisMap);
    for (const [idx, axis] of axisOverrides) {
      if (map.has(idx)) map.set(idx, axis);
    }
    return map;
  }, [autoAxisMap, axisOverrides]);

  const toggleSeriesAxis = useCallback((index: number) => {
    setAxisOverrides((prev) => {
      const next = new Map(prev);
      const current = seriesAxisMap.get(index) ?? "left";
      next.set(index, current === "left" ? "right" : "left");
      return next;
    });
  }, [seriesAxisMap]);

  const hasRightAxis = useMemo(
    () => [...seriesAxisMap.values()].some((v) => v === "right"),
    [seriesAxisMap],
  );

  /** Collect distinct unit labels for each axis side */
  const leftAxisLabel = useMemo(() => {
    if (!hasRightAxis || !isCompareMode) return undefined;
    const labels = new Set<string>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      if (seriesAxisMap.get(i) === "left")
        labels.add(compareSeriesData[i].unitShortLabel ?? "—");
    }
    return [...labels].join(", ") || undefined;
  }, [hasRightAxis, isCompareMode, compareSeriesData, seriesAxisMap, seriesVisibility]);

  const rightAxisLabel = useMemo(() => {
    if (!hasRightAxis || !isCompareMode) return undefined;
    const labels = new Set<string>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      if (seriesAxisMap.get(i) === "right")
        labels.add(compareSeriesData[i].unitShortLabel ?? "—");
    }
    return [...labels].join(", ") || undefined;
  }, [hasRightAxis, isCompareMode, compareSeriesData, seriesAxisMap, seriesVisibility]);

  /** Map series index → unit short label for tooltip display */
  const seriesUnitLabels = useMemo(() => {
    const map = new Map<number, string>();
    if (!isCompareMode) return map;
    for (let i = 0; i < compareSeriesData.length; i++) {
      map.set(i, compareSeriesData[i].unitShortLabel ?? "");
    }
    return map;
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
        pop: null,
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
    if (popData) {
      for (const [date, value] of popData) {
        const existing = map.get(date);
        if (existing) existing.pop = value;
      }
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [isCompareMode, compareChartData, data, yoy, ytd, levelChange, popData]);

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
        return {
          startIndex: getRangeStartIndex(chartData, preset.years),
          endIndex: endIdx,
        };
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
    [chartData, endIdx],
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
    [],
  );

  // ── Sync chart state → URL search params ────────────────────────────
  useEffect(() => {
    syncParamsToUrl({
      overlays: overlays.length > 0 ? overlays.join(",") : undefined,
      events:
        selectedEventTypes.size > 0
          ? [...selectedEventTypes].join(",")
          : undefined,
      transform: transformation ?? undefined,
      secondAxis: secondAxis ? "1" : undefined,
      secondAxisTransform: secondAxis
        ? (secondAxisTransformation ?? undefined)
        : undefined,
      barMode: barMode !== "yoy" ? barMode : undefined,
      rollingWindow: rollingWindow !== 12 ? String(rollingWindow) : undefined,
      indexYear: indexBaseYear !== 2015 ? String(indexBaseYear) : undefined,
      range: rangePreset && rangePreset !== "10Y" ? rangePreset : undefined,
    });
  }, [
    overlays,
    selectedEventTypes,
    transformation,
    secondAxis,
    secondAxisTransformation,
    barMode,
    rollingWindow,
    indexBaseYear,
    rangePreset,
  ]);

  // ── Min/max year from brush-selected date range ─────────────────────
  const { minYear, maxYear } = useMemo(() => {
    if (chartData.length === 0) return { minYear: 2000, maxYear: 2030 };
    const startDate =
      chartData[brushRange.startIndex]?.date ?? chartData[0].date;
    const endDate =
      chartData[brushRange.endIndex]?.date ??
      chartData[chartData.length - 1].date;
    return {
      minYear: parseInt(startDate.slice(0, 4), 10),
      maxYear: parseInt(endDate.slice(0, 4), 10),
    };
  }, [chartData, brushRange]);

  // ── Compare mode: full data with transforms (for chart + brush) ────
  const compareFullData = useMemo(() => {
    if (!isCompareMode) return [];
    return applyTransformationMulti(
      chartData,
      transformation,
      compareSeriesNames.length,
      indexBaseYear,
      rollingWindow,
    );
  }, [
    isCompareMode,
    chartData,
    transformation,
    compareSeriesNames.length,
    indexBaseYear,
    rollingWindow,
  ]);

  // ── Compare mode: sliced data with transforms (for table) ──────────
  const compareVisibleData = useMemo(() => {
    if (!isCompareMode) return [];
    return compareFullData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
  }, [isCompareMode, compareFullData, brushRange]);

  // Visible data for the chart (brush-filtered, with transforms applied)
  const visibleData = useMemo(() => {
    if (isCompareMode) return compareVisibleData;
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    let result = sliced;
    // Compute second axis transform first (reads original level)
    if (secondAxis && secondAxisTransformation) {
      result = computeSecondAxis(
        result,
        secondAxisTransformation,
        indexBaseYear,
      );
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
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    if (!transformation) return sliced;
    const transformed = applyTransformationMulti(
      sliced,
      transformation,
      compareSeriesNames.length,
      indexBaseYear,
      rollingWindow,
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
  }, [
    isCompareMode,
    chartData,
    brushRange,
    transformation,
    compareSeriesNames.length,
    indexBaseYear,
    rollingWindow,
  ]);

  // Table data — filtered to brush range, with overlays; transforms stored separately
  const tableData = useMemo(() => {
    if (isCompareMode) return compareTableData;
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    let rows = computeOverlays(sliced, effectiveOverlays, rollingWindow);
    if (secondAxis && secondAxisTransformation) {
      rows = computeSecondAxis(rows, secondAxisTransformation, indexBaseYear);
    }
    if (transformation) {
      const transformed = applyTransformation(
        rows,
        transformation,
        indexBaseYear,
      );
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
    [overlays],
  );

  // Summary stats for the brush-selected range (first series in compare mode)
  const rangeStats = useMemo(() => {
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    let levels: number[];
    if (isCompareMode) {
      levels = sliced
        .map((r) => r.series_0)
        .filter((v): v is number => v != null && !isNaN(v));
    } else {
      levels = sliced.map((r) => r.level).filter((v): v is number => v != null);
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
        ? {
            mean: rangeStats.mean,
            median: rangeStats.median,
            standardDeviation: rangeStats.stdDev,
          }
        : null,
    [rangeStats],
  );

  const fmt = (v: number) => formatLevel(v, decimals, unitShortLabel);

  // ── Compare mode: simplified transform-only toggle ─────────────────
  const makeTransformHandler =
    (
      current: Transformation | null,
      setter: (t: Transformation | null) => void,
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
                  p.minPPY <= (PERIODS_PER_YEAR[currentFreqCode ?? "M"] ?? 12),
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
              {compareUnits.map(([label, indices]) => {
                // Determine which axes this unit group spans
                const axes = new Set(
                  indices.map((i) => seriesAxisMap.get(i) ?? "left"),
                );
                const axisTags = hasRightAxis
                  ? [...axes].map((a) => (a === "left" ? "L" : "R")).join(",")
                  : null;
                return (
                  <span
                    key={label}
                    className="flex items-center gap-1 text-sm font-medium"
                  >
                    {compareUnits.length > 1 &&
                      indices.map((i) => (
                        <span
                          key={i}
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              SERIES_COLORS[i % SERIES_COLORS.length],
                          }}
                        />
                      ))}
                    {label}
                    {axisTags && (
                      <span className="text-muted-foreground text-[10px] font-normal">
                        ({axisTags})
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
          {compareUnits.length > 2 && !hasRightAxis && (
            <div className="flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">
                Series with mismatched units share a single axis
              </span>
            </div>
          )}
          {hasRightAxis && (
            <div className="flex items-center gap-1.5 text-blue-600">
              <span className="text-xs">Dual Y-axis active</span>
            </div>
          )}
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
              onValueChange={makeTransformHandler(
                transformation,
                setTransformation,
              )}
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
                showChangeTransforms={false}
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
                formula={<span>ŷ = &alpha; + &beta;t</span>}
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
            <TimelinePopover
              timelineEvents={timelineEvents}
              selectedEventTypes={selectedEventTypes}
              onSelectedEventTypesChange={setSelectedEventTypes}
            />
            {transformation === "rollingMean" &&
              (() => {
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

        {/* Two-column axis legend: Left Axis | Right Axis */}
        {(() => {
          const leftIndices = compareSeriesNames
            .map((_, i) => i)
            .filter((i) => seriesAxisMap.get(i) !== "right");
          const rightIndices = compareSeriesNames
            .map((_, i) => i)
            .filter((i) => seriesAxisMap.get(i) === "right");

          // Detect mixed units per axis (ignoring hidden series)
          const unitsOnAxis = (indices: number[]) => {
            const units = new Set<string>();
            for (const i of indices) {
              if (seriesVisibility.get(i) === "hidden") continue;
              units.add(compareSeriesData[i].unitShortLabel ?? "—");
            }
            return units;
          };
          const leftMixed = unitsOnAxis(leftIndices).size > 1;
          const rightMixed = unitsOnAxis(rightIndices).size > 1;

          const renderSeriesItem = (i: number, axisMixed: boolean) => {
            const name = compareSeriesNames[i];
            const vis = seriesVisibility.get(i);
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            const warnHighlight = axisMixed && vis !== "hidden";
            const visTitles = {
              undefined: `Gray out ${name}`,
              gray: `Hide ${name}`,
              hidden: `Show ${name}`,
            } as const;
            return (
              <div
                key={name}
                className={`flex items-center gap-1 rounded px-1 font-mono text-xs ${warnHighlight ? "bg-amber-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => cycleVisibility(i)}
                  className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{
                    opacity:
                      vis === "hidden" ? 0.4 : vis === "gray" ? 0.6 : 1,
                  }}
                  title={visTitles[vis ?? "undefined"]}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        vis === "hidden"
                          ? "transparent"
                          : vis === "gray"
                            ? "#94a3b8"
                            : color,
                      border:
                        vis === "hidden"
                          ? `1.5px solid ${color}`
                          : "1.5px solid transparent",
                    }}
                  />
                  <span className="truncate">{name}</span>
                </button>
                {compareSeriesNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => toggleSeriesAxis(i)}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    title={`Move to ${seriesAxisMap.get(i) === "right" ? "left" : "right"} axis`}
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                  </button>
                )}
                {universe && compareSeriesNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = compareSeriesNames.filter(
                        (n) => n !== name,
                      );
                      const url = new URL(window.location.href);
                      url.searchParams.set("names", remaining.join(","));
                      router.push(url.pathname + url.search);
                    }}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          };

          return (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                  Left Axis{leftAxisLabel ? ` (${leftAxisLabel})` : ""}
                </span>
                {leftIndices.length > 0 ? (
                  leftIndices.map((i) => renderSeriesItem(i, leftMixed))
                ) : (
                  <span className="text-muted-foreground text-xs italic">
                    No series
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                  Right Axis{rightAxisLabel ? ` (${rightAxisLabel})` : ""}
                </span>
                {rightIndices.length > 0 ? (
                  rightIndices.map((i) => renderSeriesItem(i, rightMixed))
                ) : (
                  <span className="text-muted-foreground text-xs italic">
                    No series
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Multi-series level chart with brush */}
        <div className="w-full py-2">
          <LevelChart
            data={compareFullData}
            decimals={decimals}
            freqCode={currentFreqCode}
            seriesNames={compareSeriesNames}
            seriesVisibility={seriesVisibility}
            seriesAxisMap={seriesAxisMap}
            leftAxisLabel={leftAxisLabel}
            rightAxisLabel={rightAxisLabel}
            seriesUnitLabels={seriesUnitLabels}
            selectedEvents={selectedEvents}
            brushStartIndex={brushRange.startIndex}
            brushEndIndex={brushRange.endIndex}
            onBrushChange={handleBrushChange}
            indexBaseYear={
              transformation === "indexToYear" ? indexBaseYear : undefined
            }
          />
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
                p.minPPY <= (PERIODS_PER_YEAR[currentFreqCode ?? "M"] ?? 12),
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

      {/* Overlays, Timeline & Transforms toggle groups */}
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
          >
            <TimelinePopover
              timelineEvents={timelineEvents}
              selectedEventTypes={selectedEventTypes}
              onSelectedEventTypesChange={setSelectedEventTypes}
            />
          </OverlaysToggle>
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
            transformation === "indexToYear" ||
            secondAxisTransformation === "indexToYear"
              ? indexBaseYear
              : undefined
          }
          selectedEvents={selectedEvents}
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
            <ToggleGroupItem value="pop" className="h-7 px-2.5 text-xs">
              {currentFreqCode === "M"
                ? "MoM %"
                : currentFreqCode === "Q"
                  ? "QoQ %"
                  : "PoP %"}
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
