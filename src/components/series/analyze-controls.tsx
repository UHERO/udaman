"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { formatLevel } from "@catalog/utils/format";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  applyTransformation,
  ChangeChart,
  computeOverlays,
  computeSecondAxis,
  LevelChart,
  TRANSFORMATION_LABELS,
  type BarMode,
  type ChartRow,
  type Overlay,
  type Transformation,
} from "./analyze-chart";
import { AnalyzeDataTable } from "./analyze-data-table";

const FREQ_LABELS: Record<string, string> = {
  A: "Annual",
  S: "Semi",
  Q: "Quarterly",
  M: "Monthly",
  W: "Weekly",
  D: "Daily",
};

/* ------------------------------------------------------------------ */
/*  Formula tooltip helper                                             */
/*  Uses a <span> wrapper so TooltipTrigger's data-state doesn't       */
/*  clobber the ToggleGroupItem's data-state="on"/"off".               */
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
/*  Toggle panel sub-components                                        */
/* ------------------------------------------------------------------ */

function ControlPanel({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-2 rounded-lg border bg-white px-4 py-3">
        {children}
      </div>
    </TooltipProvider>
  );
}

/** Shared toggle items for Transform and 2nd Axis groups */
function TransformItems() {
  return (
    <>
      <ToggleGroupItem value="none" className="h-7 px-2.5 text-xs">
        None
      </ToggleGroupItem>
      <FormulaTooltip
        formula={
          <span>
            z<sub>t</sub> = (x<sub>t</sub> &minus; x̄) / &sigma;
          </span>
        }
        description="Standard score: how many std devs from the mean"
      >
        <ToggleGroupItem value="zScore" className="h-7 px-2.5 text-xs">
          Z-Score
        </ToggleGroupItem>
      </FormulaTooltip>
      <FormulaTooltip
        formula={
          <span>
            d<sub>t</sub> = x<sub>t</sub> &minus; (&alpha; + &beta;t)
          </span>
        }
        description="Residual from OLS linear trend"
      >
        <ToggleGroupItem
          value="deviationFromTrend"
          className="h-7 px-2.5 text-xs"
        >
          Dev. from Trend
        </ToggleGroupItem>
      </FormulaTooltip>
      <FormulaTooltip
        formula={
          <span>
            y<sub>t</sub> = ln(x<sub>t</sub>), x &gt; 0
          </span>
        }
        description="Natural logarithm of level values"
      >
        <ToggleGroupItem value="logLevel" className="h-7 px-2.5 text-xs">
          Log Level
        </ToggleGroupItem>
      </FormulaTooltip>
    </>
  );
}

function OverlaysToggle({
  overlays,
  onValueChange,
  disabled,
  stats,
  fmtMean,
}: {
  overlays: Overlay[];
  onValueChange: (values: string[]) => void;
  disabled: boolean;
  stats: { mean: number; median: number | null; standardDeviation: number };
  fmtMean: (v: number) => string;
}) {
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
        <FormulaTooltip
          formula={
            <span>
              x̄ = <sup>1</sup>&frasl;<sub>n</sub> &Sigma; x<sub>i</sub>
            </span>
          }
          description="Arithmetic mean of all observations"
        >
          <ToggleGroupItem value="mean" className="h-7 gap-1.5 px-2.5 text-xs">
            <span className="text-muted-foreground">Mean</span>
            <span className="font-mono">{fmtMean(stats.mean)}</span>
          </ToggleGroupItem>
        </FormulaTooltip>
        <FormulaTooltip
          formula={
            <span>
              x̄<sub>t</sub> = <sup>1</sup>&frasl;<sub>k</sub> &Sigma;
              <sub>i=t&minus;k+1</sub>
              <sup>t</sup> x<sub>i</sub>
            </span>
          }
          description="Backward-looking moving average (k=12)"
        >
          <ToggleGroupItem
            value="rollingMean"
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <span className="text-muted-foreground">Rolling x̄</span>
          </ToggleGroupItem>
        </FormulaTooltip>
        <FormulaTooltip
          formula={
            <span>
              x̄<sub>t</sub> &plusmn; &sigma;<sub>t</sub> where &sigma;
              <sub>t</sub> = &radic;(
              <sup>1</sup>&frasl;<sub>k&minus;1</sub> &Sigma;(x
              <sub>i</sub> &minus; x̄<sub>t</sub>)&sup2;)
            </span>
          }
          description="Rolling mean ± 1 sample std dev (k=12)"
        >
          <ToggleGroupItem
            value="rollingStdDev"
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <span className="text-muted-foreground">&plusmn;&sigma; Band</span>
          </ToggleGroupItem>
        </FormulaTooltip>
        <FormulaTooltip
          formula={
            <span>
              ŷ = &alpha; + &beta;t where &beta; = (n&Sigma;ty &minus;
              &Sigma;t&Sigma;y) / (n&Sigma;t&sup2; &minus; (&Sigma;t)&sup2;)
            </span>
          }
          description="OLS linear trend on observation index"
        >
          <ToggleGroupItem
            value="linearTrend"
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <span className="text-muted-foreground">Linear</span>
          </ToggleGroupItem>
        </FormulaTooltip>
        <FormulaTooltip
          formula={
            <span>
              ŷ = e<sup>&alpha; + &beta;t</sup> &mdash; regress ln(y) on t
            </span>
          }
          description="Exponential trend via log-linear regression"
        >
          <ToggleGroupItem
            value="logLinearTrend"
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <span className="text-muted-foreground">Log-Linear</span>
          </ToggleGroupItem>
        </FormulaTooltip>
        <FormulaTooltip
          formula={
            <span>
              min<sub>&tau;</sub> &Sigma;(y<sub>t</sub> &minus; &tau;
              <sub>t</sub>)&sup2; + &lambda;&Sigma;(&Delta;&sup2; &tau;
              <sub>t</sub>)&sup2;
            </span>
          }
          description="Hodrick-Prescott filter (&lambda; auto by frequency)"
        >
          <ToggleGroupItem
            value="hpTrend"
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <span className="text-muted-foreground">HP Trend</span>
          </ToggleGroupItem>
        </FormulaTooltip>
        <FormulaTooltip
          formula={<span>NBER recession shading</span>}
          description="Peak-to-trough dates from the National Bureau of Economic Research"
        >
          <ToggleGroupItem
            value="recessions"
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <span className="text-muted-foreground">Recessions</span>
          </ToggleGroupItem>
        </FormulaTooltip>
      </ToggleGroup>
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
}: {
  value: Transformation | null;
  onValueChange: (t: Transformation | null) => void;
  secondAxis: boolean;
  onSecondAxisToggle: () => void;
  secondAxisValue: Transformation | null;
  onSecondAxisValueChange: (t: Transformation | null) => void;
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
          <TransformItems />
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
            {/* <TransformItems /> */}
            <ToggleGroupItem value="none" className="h-7 px-2.5 text-xs">
              None
            </ToggleGroupItem>
            <FormulaTooltip
              formula={
                <span>
                  z<sub>t</sub> = (x<sub>t</sub> &minus; x̄) / &sigma;
                </span>
              }
              description="Standard score: how many std devs from the mean"
            >
              <ToggleGroupItem value="zScore" className="h-7 px-2.5 text-xs">
                Z-Score
              </ToggleGroupItem>
            </FormulaTooltip>
            <FormulaTooltip
              formula={
                <span>
                  d<sub>t</sub> = x<sub>t</sub> &minus; (&alpha; + &beta;t)
                </span>
              }
              description="Residual from OLS linear trend"
            >
              <ToggleGroupItem
                value="deviationFromTrend"
                className="h-7 px-2.5 text-xs"
              >
                Dev. from Trend
              </ToggleGroupItem>
            </FormulaTooltip>
            <FormulaTooltip
              formula={
                <span>
                  y<sub>t</sub> = ln(x<sub>t</sub>), x &gt; 0
                </span>
              }
              description="Natural logarithm of level values"
            >
              <ToggleGroupItem value="logLevel" className="h-7 px-2.5 text-xs">
                Log Level
              </ToggleGroupItem>
            </FormulaTooltip>
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
  stats?: { mean: number; median: number | null; standardDeviation: number };
  unitLabel?: string | null;
  unitShortLabel?: string | null;
  universe?: string;
  currentFreqCode?: string | null;
  siblings?: Array<{ freqCode: string; id: number; name: string }>;
}

export function AnalyzeControls({
  data,
  yoy,
  ytd,
  levelChange,
  decimals,
  stats,
  unitLabel,
  unitShortLabel,
  universe,
  currentFreqCode,
  siblings,
}: AnalyzeControlsProps) {
  const [barMode, setBarMode] = useState<BarMode>("yoy");
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [transformation, setTransformation] = useState<Transformation | null>(
    null
  );
  const [secondAxis, setSecondAxis] = useState(false);
  const [secondAxisTransformation, setSecondAxisTransformation] =
    useState<Transformation | null>(null);

  // When second axis is on, overlays are disabled
  const effectiveOverlays = useMemo(
    () => (secondAxis ? [] : overlays),
    [secondAxis, overlays]
  );

  const chartData = useMemo(() => {
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
  }, [data, yoy, ytd, levelChange]);

  const [brushRange, setBrushRange] = useState<{
    startIndex: number;
    endIndex: number;
  }>({ startIndex: 0, endIndex: Math.max(0, chartData.length - 1) });

  const handleBrushChange = useCallback(
    (range: { startIndex?: number; endIndex?: number }) => {
      setBrushRange((prev) => ({
        startIndex: range.startIndex ?? prev.startIndex,
        endIndex: range.endIndex ?? prev.endIndex,
      }));
    },
    []
  );

  // Visible data for the chart (brush-filtered, with transforms applied)
  const visibleData = useMemo(() => {
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1
    );
    let result = sliced;
    // Compute second axis transform first (reads original level)
    if (secondAxis && secondAxisTransformation) {
      result = computeSecondAxis(result, secondAxisTransformation);
    }
    // Apply main transformation (replaces level)
    result = applyTransformation(result, transformation);
    return result;
  }, [
    chartData,
    brushRange,
    transformation,
    secondAxis,
    secondAxisTransformation,
  ]);

  // Full data for the table (not brush-filtered, with overlays + transform computed)
  const tableData = useMemo(() => {
    let rows = computeOverlays(chartData, effectiveOverlays);
    if (secondAxis && secondAxisTransformation) {
      rows = computeSecondAxis(rows, secondAxisTransformation);
    }
    if (transformation) {
      rows = applyTransformation(rows, transformation);
    }
    return rows;
  }, [
    chartData,
    effectiveOverlays,
    transformation,
    secondAxis,
    secondAxisTransformation,
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

  const hasSiblings = universe && siblings && siblings.length > 1;

  const fmt = (v: number) => formatLevel(v, decimals, unitShortLabel);

  return (
    <div className="space-y-3">
      {/* FRED-style control bar */}
      <div className="flex items-start justify-between gap-4 rounded-lg border bg-white px-4 py-3">
        {/* Col 1: Frequency */}
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Frequency</span>
          {hasSiblings ? (
            <ToggleGroup
              type="single"
              value={currentFreqCode ?? undefined}
              variant="outline"
              size="sm"
            >
              {siblings!.map((s) => {
                const label = FREQ_LABELS[s.freqCode] ?? s.freqCode;
                const isCurrent = s.freqCode === currentFreqCode;
                if (isCurrent) {
                  return (
                    <ToggleGroupItem
                      key={s.freqCode}
                      value={s.freqCode}
                      className="h-7 px-2.5 text-xs"
                    >
                      {label}
                    </ToggleGroupItem>
                  );
                }
                return (
                  <Link
                    key={s.freqCode}
                    href={`/udaman/${universe}/series/${s.id}/analyze`}
                  >
                    <ToggleGroupItem
                      value={s.freqCode}
                      className="h-7 px-2.5 text-xs"
                    >
                      {label}
                    </ToggleGroupItem>
                  </Link>
                );
              })}
            </ToggleGroup>
          ) : (
            <span className="text-sm font-medium">—</span>
          )}
        </div>

        {/* Col 2: Units */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-muted-foreground text-xs">Units</span>
          <span className="text-sm font-medium">{unitLabel || "—"}</span>
        </div>
      </div>

      {/* Overlays & Transforms toggle groups */}
      {stats && (
        <ControlPanel>
          <OverlaysToggle
            overlays={overlays}
            onValueChange={handleOverlayChange}
            disabled={secondAxis}
            stats={stats}
            fmtMean={fmt}
          />
          <TransformToggle
            value={transformation}
            onValueChange={setTransformation}
            secondAxis={secondAxis}
            onSecondAxisToggle={() => setSecondAxis((v) => !v)}
            secondAxisValue={secondAxisTransformation}
            onSecondAxisValueChange={setSecondAxisTransformation}
          />
        </ControlPanel>
      )}

      {/* Level line chart */}
      <div className="w-full rounded-lg border bg-white p-4">
        <LevelChart
          data={visibleData}
          decimals={decimals}
          stats={stats}
          overlays={effectiveOverlays}
          unitShortLabel={unitShortLabel}
          secondAxis={secondAxis}
          transformationLabel={
            secondAxisTransformation
              ? TRANSFORMATION_LABELS[secondAxisTransformation]
              : undefined
          }
        />
      </div>

      {/* Bar chart with mode toggle */}
      <div className="w-full rounded-lg border bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={barMode}
            onValueChange={(v) => {
              if (v) setBarMode(v as BarMode);
            }}
            variant="outline"
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
        />
      </div>

      {/* Data table — shares overlay/transform state with charts */}
      <AnalyzeDataTable
        rows={tableData}
        decimals={decimals}
        unitShortLabel={unitShortLabel}
        activeOverlays={effectiveOverlays}
        activeTransformation={secondAxis ? secondAxisTransformation : null}
        secondAxis={secondAxis}
      />
    </div>
  );
}
