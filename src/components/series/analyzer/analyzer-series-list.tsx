"use client";

import { useMemo } from "react";

import { SERIES_COLORS } from "@/components/series/analyze-chart";

import { AnalyzerSeriesRow } from "./analyzer-series-row";
import type { AnalyzerEntry } from "./types";

interface AnalyzerSeriesListProps {
  entries: AnalyzerEntry[];
  selectedStatsId?: string | null;
  onSelectStats?: (id: string) => void;
  onExpressionChange: (id: string, expression: string) => void;
  onVisibilityChange: (id: string, visibility: AnalyzerEntry["visibility"]) => void;
  onAxisChange: (id: string, axis: "left" | "right") => void;
  onRemove: (id: string) => void;
}

export function AnalyzerSeriesList({
  entries,
  selectedStatsId,
  onSelectStats,
  onExpressionChange,
  onVisibilityChange,
  onAxisChange,
  onRemove,
}: AnalyzerSeriesListProps) {
  // Build a stable color map based on full-list index
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((entry, i) => {
      map.set(entry.id, SERIES_COLORS[i % SERIES_COLORS.length]);
    });
    return map;
  }, [entries]);

  const leftEntries = useMemo(
    () => entries.filter((e) => e.axis !== "right"),
    [entries],
  );
  const rightEntries = useMemo(
    () => entries.filter((e) => e.axis === "right"),
    [entries],
  );

  if (entries.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-md border border-dashed">
        <p className="text-muted-foreground text-sm">
          Search for series to add them to the chart
        </p>
      </div>
    );
  }

  const renderRow = (entry: AnalyzerEntry) => (
    <AnalyzerSeriesRow
      key={entry.id}
      entry={entry}
      color={colorMap.get(entry.id) ?? SERIES_COLORS[0]}
      isStatsSelected={selectedStatsId === entry.id}
      onSelectStats={onSelectStats}
      onExpressionChange={onExpressionChange}
      onVisibilityChange={onVisibilityChange}
      onAxisChange={onAxisChange}
      onRemove={onRemove}
    />
  );

  return (
    <div className="max-h-[300px] overflow-y-auto rounded-md border p-1">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <span className="text-muted-foreground px-1 text-[10px] font-medium tracking-wide uppercase">
            Left Axis
          </span>
          {leftEntries.length > 0 ? (
            leftEntries.map(renderRow)
          ) : (
            <span className="text-muted-foreground px-1 text-xs italic">
              No series
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          <span className="text-muted-foreground px-1 text-[10px] font-medium tracking-wide uppercase">
            Right Axis
          </span>
          {rightEntries.length > 0 ? (
            rightEntries.map(renderRow)
          ) : (
            <span className="text-muted-foreground px-1 text-xs italic">
              No series
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
