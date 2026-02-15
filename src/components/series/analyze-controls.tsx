"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { formatLevel } from "@catalog/utils/format";

import {
  ChangeChart,
  LevelChart,
  type BarMode,
  type ChartRow,
  type StatsOverlay,
} from "./analyze-chart";

const FREQ_LABELS: Record<string, string> = {
  A: "Annual",
  S: "Semi",
  Q: "Quarterly",
  M: "Monthly",
  W: "Weekly",
  D: "Daily",
};

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
  const [statsOverlay, setStatsOverlay] = useState<StatsOverlay[]>([]);

  const chartData = useMemo(() => {
    const map = new Map<string, ChartRow>();
    for (const [date, value] of data) {
      map.set(date, { date, level: value, levelChange: null, yoy: null, ytd: null });
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
    [],
  );

  const visibleData = useMemo(() => {
    return chartData.slice(brushRange.startIndex, brushRange.endIndex + 1);
  }, [chartData, brushRange]);

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

      {/* Stats overlay toggles — above the chart */}
      {stats && (
        <ToggleGroup
          type="multiple"
          value={statsOverlay}
          onValueChange={(v) => setStatsOverlay(v as StatsOverlay[])}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="mean" className="h-7 gap-1.5 px-2.5 text-xs">
            <span className="text-muted-foreground">Mean</span>
            <span className="font-mono">{fmt(stats.mean)}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="median" className="h-7 gap-1.5 px-2.5 text-xs">
            <span className="text-muted-foreground">Median</span>
            <span className="font-mono">
              {stats.median != null ? fmt(stats.median) : "—"}
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem value="stdDev" className="h-7 gap-1.5 px-2.5 text-xs">
            <span className="text-muted-foreground">Std Dev</span>
            <span className="font-mono">{fmt(stats.standardDeviation)}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="trend" className="h-7 gap-1.5 px-2.5 text-xs">
            <span className="text-muted-foreground">Trend</span>
          </ToggleGroupItem>
        </ToggleGroup>
      )}

      {/* Level line chart */}
      <div className="w-full rounded-lg border bg-white p-4">
        <LevelChart
          data={visibleData}
          decimals={decimals}
          stats={stats}
          overlays={statsOverlay}
          unitShortLabel={unitShortLabel}
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
    </div>
  );
}
