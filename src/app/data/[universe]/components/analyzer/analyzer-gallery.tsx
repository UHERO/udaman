"use client";

import { useMemo } from "react";
import { ChartColumnBig, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { portalHref } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import { getTransformations, seriesChartData } from "../../lib/series";
import type { SeriesChartRow } from "../../lib/types";
import { CategoryChartCard } from "../category/category-chart-card";
import type { TableTransform } from "../selectors/transform-toggle";
import { transformationPoints } from "./analyzer-model";
import type { AnalyzerSeriesSpec } from "./analyzer-model";
import { saParam } from "./analyzer-table";

/**
 * Gallery view (category-charts in analyzerView mode): one detailed
 * CategoryChartCard per analyzer series, with a compare toggle (add to /
 * remove from the Compare chart; outlined + filled while included) and a
 * remove-from-analyzer button.
 */
export function AnalyzerGallery({
  specs,
  startDate,
  endDate,
  indexed,
  baseDate,
  onToggleCompare,
  onRemove,
  growth = null,
}: {
  specs: AnalyzerSeriesSpec[];
  startDate: string;
  endDate: string;
  indexed: boolean;
  baseDate: string | null;
  onToggleCompare: (id: number) => void;
  onRemove: (id: number) => void;
  /** Growth-rate bars behind each card's line. */
  growth?: TableTransform | null;
}) {
  const lastVisible = specs.filter((s) => s.visible).length <= 1;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
      {specs.map((spec) => (
        <GalleryCard
          key={spec.id}
          spec={spec}
          startDate={startDate}
          endDate={endDate}
          indexed={indexed}
          baseDate={baseDate}
          growth={growth}
          disableRemoveCompare={spec.visible && lastVisible}
          onToggleCompare={() => onToggleCompare(spec.id)}
          onRemove={() => onRemove(spec.id)}
        />
      ))}
    </div>
  );
}

function GalleryCard({
  spec,
  startDate,
  endDate,
  indexed,
  baseDate,
  disableRemoveCompare,
  onToggleCompare,
  onRemove,
  growth,
}: {
  spec: AnalyzerSeriesSpec;
  startDate: string;
  endDate: string;
  indexed: boolean;
  baseDate: string | null;
  disableRemoveCompare: boolean;
  onToggleCompare: () => void;
  onRemove: () => void;
  growth: TableTransform | null;
}) {
  const { config } = usePortalConfig();
  const s = spec.series;

  // Index mode: level values rebased to 100 at the base date.
  const chartData = useMemo(() => {
    const d = seriesChartData(s);
    if (!indexed || !baseDate) return d;
    const level = getTransformations(
      s.seriesObservations.transformationResults,
    ).level;
    const pts = transformationPoints(level, baseDate);
    const byDate = new Map(pts.dates.map((date, i) => [date, pts.values[i]]));
    return {
      ...d,
      rows: d.rows.map<SeriesChartRow>((r) => ({
        ...r,
        level: byDate.get(r.date) ?? null,
      })),
    };
  }, [s, indexed, baseDate]);

  const hasIndexedData =
    !indexed ||
    chartData.rows.some(
      (r) => r.date >= startDate && r.date <= endDate && r.level !== null,
    );

  const compareLabel = spec.visible
    ? "Remove from Comparison"
    : "Add to Comparison";

  return (
    <CategoryChartCard
      detailed
      series={s}
      href={portalHref(config.universe, "series", { id: s.id, sa: saParam(s) })}
      displayName={indexed ? `${s.title} (Index)` : s.title}
      chartData={chartData}
      valueLabel={indexed ? "Index" : undefined}
      startDate={startDate}
      endDate={endDate}
      slot={spec.slot}
      growth={growth}
      selected={spec.visible}
      emptyMessage={
        !spec.hasData
          ? "Data not available"
          : !hasIndexedData
            ? "Not available for current base year"
            : null
      }
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={compareLabel}
                aria-pressed={spec.visible}
                disabled={disableRemoveCompare}
                onClick={onToggleCompare}
                className={cn(
                  "size-7 rounded-none",
                  spec.visible
                    ? "bg-(--portal-primary) text-white hover:bg-(--portal-primary)/90 hover:text-white"
                    : "text-muted-foreground hover:text-(--portal-primary)",
                )}
              >
                <ChartColumnBig className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {disableRemoveCompare
                ? "At least one series stays in the comparison"
                : compareLabel}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove from Analyzer"
                onClick={onRemove}
                className="text-muted-foreground hover:text-destructive size-7 rounded-none"
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove from Analyzer</TooltipContent>
          </Tooltip>
        </>
      }
    />
  );
}
