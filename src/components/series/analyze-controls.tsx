"use client";

import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { AnalyzeChart, type BarMode } from "./analyze-chart";
import { StatsTable } from "./stats-table";

interface AnalyzeControlsProps {
  data: [string, number][];
  yoy: [string, number][];
  ytd: [string, number][];
  levelChange: [string, number][];
  decimals: number;
  stats?: { mean: number; median: number | null; standardDeviation: number };
  unitLabel?: string | null;
}

export function AnalyzeControls({
  data,
  yoy,
  ytd,
  levelChange,
  decimals,
  stats,
  unitLabel,
}: AnalyzeControlsProps) {
  const [barMode, setBarMode] = useState<BarMode>("yoy");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 rounded-lg border bg-white px-4 py-3">
        {/* Stats */}
        {stats && (
          <div>
            <StatsTable
              mean={stats.mean}
              median={stats.median}
              standardDeviation={stats.standardDeviation}
              decimals={decimals}
            />
          </div>
        )}

        {/* Bar mode selector */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-muted-foreground text-xs">Bars</span>
          <ToggleGroup
            type="single"
            value={barMode}
            onValueChange={(v) => {
              if (v) setBarMode(v as BarMode);
            }}
            variant="outline"
            size="sm"
            orientation="vertical"
            className="flex-col"
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

        {/* Unit label */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-muted-foreground text-xs">Units</span>
          <span className="text-sm font-medium">{unitLabel || "—"}</span>
        </div>
      </div>

      <AnalyzeChart
        data={data}
        yoyData={yoy}
        ytdData={ytd}
        levelChangeData={levelChange}
        decimals={decimals}
        barMode={barMode}
      />
    </div>
  );
}
