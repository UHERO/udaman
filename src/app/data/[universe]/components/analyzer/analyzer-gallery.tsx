"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChartColumn, ChartColumnBig, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { formatTooltipDate } from "../../lib/dates";
import { formatNum, seriesDecimals } from "../../lib/format";
import { portalHref } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import {
  changeLabels,
  getTransformations,
  seriesChartData,
  seriesUnits,
} from "../../lib/series";
import type { SeriesChartRow } from "../../lib/types";
import { MiniLineChart } from "../ui/mini-line-chart";
import { PortalCard } from "../ui/portal-card";
import { transformationPoints } from "./analyzer-model";
import type { AnalyzerSeriesSpec } from "./analyzer-model";
import { saParam } from "./analyzer-table";

/**
 * Gallery view (category-charts in analyzerView mode): one mini chart per
 * analyzer series with a compare toggle (add to / remove from the comparison
 * chart) and a remove-from-analyzer button.
 */
export function AnalyzerGallery({
  specs,
  startDate,
  endDate,
  indexed,
  baseDate,
  onToggleCompare,
  onRemove,
}: {
  specs: AnalyzerSeriesSpec[];
  startDate: string;
  endDate: string;
  indexed: boolean;
  baseDate: string | null;
  onToggleCompare: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const lastVisible = specs.filter((s) => s.visible).length <= 1;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {specs.map((spec) => (
        <GalleryCard
          key={spec.id}
          spec={spec}
          startDate={startDate}
          endDate={endDate}
          indexed={indexed}
          baseDate={baseDate}
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
}: {
  spec: AnalyzerSeriesSpec;
  startDate: string;
  endDate: string;
  indexed: boolean;
  baseDate: string | null;
  disableRemoveCompare: boolean;
  onToggleCompare: () => void;
  onRemove: () => void;
}) {
  const { config } = usePortalConfig();
  const s = spec.series;
  const decimals = seriesDecimals(s);
  const secondary =
    config.miniChart.showSecondary && !indexed
      ? config.miniChart.secondary
      : null;

  const { rows, pseudoZones } = useMemo(() => {
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

  const inRange = rows.filter(
    (r) => r.date >= startDate && r.date <= endDate && r.level !== null,
  );
  const latest = inRange[inRange.length - 1];
  const labels = changeLabels(s.percent);
  const companionLabel =
    secondary === "yoy"
      ? labels.yoy
      : secondary === "ytd"
        ? labels.ytd
        : secondary === "c5ma"
          ? "Annual Change"
          : undefined;

  const compareLabel = spec.visible
    ? "Remove from Comparison"
    : "Add to Comparison";

  return (
    <PortalCard className="flex flex-col">
      <header className="flex items-start gap-2 px-3 pt-3 pb-1">
        <div className="min-w-0 flex-1">
          <Link
            href={portalHref(config.universe, "series", {
              id: s.id,
              sa: saParam(s),
            })}
            className="text-foreground line-clamp-2 text-sm leading-tight font-semibold hover:underline"
            title={spec.name}
          >
            {indexed ? `${s.title} (Index)` : s.title}
          </Link>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {s.geography.shortName} · {s.frequency}
            {latest && (
              <>
                {" · "}
                <span className="text-foreground tabular-nums">
                  {formatNum(latest.level, decimals, config.universe)}
                </span>{" "}
                {indexed ? "Index" : seriesUnits(s)} (
                {formatTooltipDate(latest.date, s.frequencyShort)})
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
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
                    : "text-muted-foreground",
                )}
              >
                {spec.visible ? (
                  <ChartColumnBig className="size-4" />
                ) : (
                  <ChartColumn className="size-4" />
                )}
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
        </div>
      </header>
      <div className="px-2 pb-2">
        {!spec.hasData ? (
          <EmptyChart text="Data not available" />
        ) : indexed && !inRange.length ? (
          <EmptyChart text="Not available for current base year" />
        ) : (
          <MiniLineChart
            rows={rows}
            freq={s.frequencyShort}
            decimals={decimals}
            universe={config.universe}
            slot={spec.slot}
            levelLabel={indexed ? "Index" : "Level"}
            companion={secondary}
            companionLabel={companionLabel}
            startDate={startDate}
            endDate={endDate}
            pseudoZones={pseudoZones}
            height={150}
          />
        )}
      </div>
    </PortalCard>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="text-muted-foreground flex h-[150px] items-center justify-center text-xs">
      {text}
    </div>
  );
}
