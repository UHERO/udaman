"use client";

import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { lowerBound } from "../../lib/dates";
import type {
  DateEntry,
  FreqCode,
  TransformationDisplayName,
} from "../../lib/types";
import type { TableTransform } from "../selectors/transform-toggle";
import { ChartZoomBar, useChartZoom } from "../ui/use-chart-zoom";
import { AnalyzerChart } from "./analyzer-chart";
import type { AxisBounds } from "./analyzer-chart";
import type {
  AnalyzerChartType,
  AnalyzerSeriesSpec,
  AxisSide,
} from "./analyzer-model";

export interface CompareActions {
  onRange: (startDate: string, endDate: string) => void;
  onSetAxis: (id: number, side: AxisSide) => void;
  onSetType: (id: number, type: AnalyzerChartType) => void;
  onSetTransformation: (id: number, t: TransformationDisplayName) => void;
  onSetAllTransformations: (t: TransformationDisplayName) => void;
  onToggleCompare: (id: number) => void;
  onRemove: (id: number) => void;
  onBound: (key: keyof AxisBounds, value: number | null) => void;
}

/** Debounce for writing zoom changes to the URL (series-view uses the same). */
const URL_WRITE_DELAY = 250;

/**
 * Compare view (analyzer-highstock): the comparison chart (wheel /
 * double-click zoom via useChartZoom) with per-series settings in the
 * legend. Range presets, Download and the date slider live in the page
 * header (analyzer-view); y-axes always fit the visible range.
 */
export function AnalyzerCompare({
  specs,
  baseDate,
  freq,
  sliderDates,
  startDate: urlStartDate,
  endDate: urlEndDate,
  chartRef,
  actions,
  growth = null,
}: {
  specs: AnalyzerSeriesSpec[];
  baseDate: string | null;
  freq: FreqCode;
  sliderDates: DateEntry[];
  startDate: string;
  endDate: string;
  /** Owned by the page so the header Download menu can export the chart. */
  chartRef: React.RefObject<HTMLDivElement | null>;
  actions: CompareActions;
  /** Growth-rate bars behind each line (top-of-page YOY/YTD toggle). */
  growth?: TableTransform | null;
}) {
  const visible = specs.filter((s) => s.visible);
  const onlyOneVisible = visible.length <= 1;
  const list = sliderDates.map((d) => d.date);

  // ── Zoom (wheel / double-click) ─────────────────────────────────
  // The chart follows a local pending window immediately; the URL (and so
  // the slider, table and stats) follows after URL_WRITE_DELAY.
  const [pending, setPending] = useState<{
    start: string;
    end: string;
    base: string;
  } | null>(null);
  const urlKey = `${urlStartDate}|${urlEndDate}`;
  const activePending = pending && pending.base === urlKey ? pending : null;
  // Once the URL moves (our write landed, or a button/slider changed it)
  // the stale pending window is ignored.
  const startDate = activePending?.start ?? urlStartDate;
  const endDate = activePending?.end ?? urlEndDate;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const zoomTo = (lo: number, hi: number) => {
    const s = list[lo];
    const e = list[hi];
    if (!s || !e) return;
    setPending({ start: s, end: e, base: urlKey });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => actions.onRange(s, e), URL_WRITE_DELAY);
  };
  const indexOf = (d: string) =>
    Math.max(0, Math.min(lowerBound(list, d), list.length - 1));
  const zoom = useChartZoom(chartRef, {
    count: list.length,
    start: indexOf(startDate),
    end: indexOf(endDate),
    freq,
    onChange: zoomTo,
    enabled: visible.length > 0,
  });

  return (
    <div className="space-y-3">
      <ChartZoomBar zoom={zoom} className="-mb-2" />
      <AnalyzerChart
        ref={chartRef}
        specs={specs}
        baseDate={baseDate}
        startDate={startDate}
        endDate={endDate}
        freq={freq}
        growth={growth}
        legendShowsHidden
        renderLegendControls={(s) => (
          <SeriesSettings
            spec={s}
            disableRemoveCompare={s.visible && onlyOneVisible}
            actions={actions}
          />
        )}
      />
    </div>
  );
}

/** Legend gear menu: axis side, chart type, values, compare / analyzer membership. */
function SeriesSettings({
  spec,
  disableRemoveCompare,
  actions,
}: {
  spec: AnalyzerSeriesSpec;
  disableRemoveCompare: boolean;
  actions: CompareActions;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Options for ${spec.series.title}`}
          className={cn(
            "size-6 shrink-0 rounded-none",
            spec.visible ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <Settings2 className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-56 rounded-none"
      >
        {spec.visible && (
          <>
            <DropdownMenuLabel className="text-muted-foreground text-[11px] uppercase">
              Y-Axis
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={spec.axis}
              onValueChange={(v) => actions.onSetAxis(spec.id, v as AxisSide)}
            >
              <DropdownMenuRadioItem value="left">Left</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="right">Right</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-[11px] uppercase">
              Chart Type
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={spec.type}
              onValueChange={(v) =>
                actions.onSetType(spec.id, v as AnalyzerChartType)
              }
            >
              <DropdownMenuRadioItem value="line">Line</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="column">
                Column
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="area">Area</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-muted-foreground text-[11px] uppercase">
          Values
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={spec.transformation}
          onValueChange={(v) =>
            actions.onSetTransformation(spec.id, v as TransformationDisplayName)
          }
        >
          {spec.chartValues.map((t) => (
            <DropdownMenuRadioItem key={t} value={t}>
              {t}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={disableRemoveCompare}
          onSelect={() => actions.onToggleCompare(spec.id)}
        >
          {spec.visible ? "Remove From Comparison" : "Add To Comparison"}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => actions.onRemove(spec.id)}
        >
          Remove From Analyzer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
