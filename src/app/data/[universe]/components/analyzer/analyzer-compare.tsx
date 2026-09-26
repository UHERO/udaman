"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Settings2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { getChartPalette } from "../../lib/config";
import { downloadCsv, toCsv } from "../../lib/csv";
import { lowerBound } from "../../lib/dates";
import { formatAxisNumber, formatNum } from "../../lib/format";
import { usePortalConfig } from "../../lib/portal-context";
import type {
  DateEntry,
  FreqCode,
  TransformationDisplayName,
} from "../../lib/types";
import { ChartZoomBar, useChartZoom } from "../ui/use-chart-zoom";
import { AnalyzerChart, specStroke } from "./analyzer-chart";
import type { AxisBounds } from "./analyzer-chart";
import {
  analyzerChartRows,
  axisExtent,
  axisTitle,
  specKey,
} from "./analyzer-model";
import type {
  AnalyzerChartType,
  AnalyzerSeriesSpec,
  AxisSide,
} from "./analyzer-model";
import { exportChartImage, exportTablePdf } from "./chart-export";
import type { ImageFormat } from "./chart-export";

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

const btn =
  "h-7 rounded-none px-2 text-xs font-medium shadow-none data-[active=true]:bg-(--portal-primary) data-[active=true]:text-white";

/**
 * Compare view (analyzer-highstock): range buttons, whole-chart
 * transformation buttons, Download menu (PNG/JPEG/SVG/PDF/CSV/table PDF),
 * the comparison chart (wheel / double-click zoom via useChartZoom) with
 * per-series settings in the legend, and y-axis min/max inputs.
 */
export function AnalyzerCompare({
  specs,
  baseDate,
  freq,
  sliderDates,
  startDate: urlStartDate,
  endDate: urlEndDate,
  bounds,
  actions,
}: {
  specs: AnalyzerSeriesSpec[];
  baseDate: string | null;
  freq: FreqCode;
  sliderDates: DateEntry[];
  startDate: string;
  endDate: string;
  bounds: AxisBounds;
  actions: CompareActions;
}) {
  const { config } = usePortalConfig();
  const palette = getChartPalette(config);
  const chartRef = useRef<HTMLDivElement>(null);
  const visible = specs.filter((s) => s.visible);
  const onlyOneVisible = visible.length <= 1;
  const list = sliderDates.map((d) => d.date);
  const first = list[0];
  const last = list[list.length - 1];

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

  // ── Range buttons (rangeSelector) ────────────────────────────────
  const buttons = config.seriesChart.rangeButtons.filter(
    (b) => !(b === 1 && freq === "A"),
  );
  const rangeFor = (b: number | "all"): [string, string] | null => {
    if (!first) return null;
    if (b === "all") return [first, last];
    const target = `${+endDate.substring(0, 4) - b}${endDate.substring(4)}`;
    const i = Math.min(lowerBound(list, target), list.length - 1);
    return [list[i], endDate];
  };

  // ── Whole-chart transformation buttons (chartTransformationToggles) ─
  const allValues = [
    ...new Set(specs.flatMap((s) => s.chartValues)),
  ] as TransformationDisplayName[];
  const commonValue =
    visible.length &&
    visible.every((s) => s.transformation === visible[0].transformation)
      ? visible[0].transformation
      : null;

  // ── Exports ─────────────────────────────────────────────────────
  const legend = visible.map((s) => ({
    color: specStroke(palette, s.slot).color,
    dashed: !!specStroke(palette, s.slot).dash,
    kind: s.type === "column" ? ("bar" as const) : ("line" as const),
    label: `${s.name} (${s.axis})`,
  }));
  const exportSource = [
    config.exportLabels.portal,
    config.exportLabels.portalLink,
  ];
  const exportImage = (format: ImageFormat) => {
    if (!chartRef.current) return;
    void exportChartImage(chartRef.current, format, "chart", {
      leftTitle: visible.some((s) => s.axis === "left")
        ? axisTitle(specs, "left")
        : undefined,
      rightTitle: visible.some((s) => s.axis === "right")
        ? axisTitle(specs, "right")
        : undefined,
      legend,
      credits: config.seriesChart.credits,
      title: `${config.shortTitle} Analyzer`,
      subtitle: `${startDate} – ${endDate}`,
      source: exportSource,
    });
  };
  const exportTable = () => {
    const { rows } = analyzerChartRows(specs, baseDate, startDate, endDate);
    void exportTablePdf({
      fileName: "chart",
      title: `${config.shortTitle} Analyzer`,
      subtitle: `${startDate} – ${endDate}`,
      head: ["Date", ...visible.map((s) => `${s.name} (${s.axis})`)],
      body: rows
        .slice()
        .reverse()
        .map((r) => [
          r.date,
          ...visible.map((s) => {
            const v = r[specKey(s.id)];
            return typeof v === "number"
              ? formatNum(v, s.decimals, config.universe)
              : "";
          }),
        ]),
      footer: exportSource,
      columnsPerBlock: 4,
      orientation: "landscape",
    });
  };
  const exportCsv = () => {
    const { rows } = analyzerChartRows(specs, baseDate, startDate, endDate);
    const body = [
      ["Date", ...visible.map((s) => `${s.name} (${s.axis})`)],
      ...rows.map((r) => [
        r.date,
        ...visible.map((s) => r[specKey(s.id)] ?? null),
      ]),
    ];
    const meta = [config.exportLabels.portal, config.exportLabels.portalLink]
      .filter(Boolean)
      .join("\n");
    downloadCsv("chart", `${meta}\n\n${toCsv(body)}`);
  };

  // ── Y-axis min/max inputs (customize-yAxis) ─────────────────────
  const { rows } = analyzerChartRows(specs, baseDate, startDate, endDate);
  const sides = (["left", "right"] as AxisSide[]).filter((side) =>
    visible.some((s) => s.axis === side),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {buttons.length > 0 && (
            <span className="text-muted-foreground mr-1 text-[11px] font-semibold tracking-wider uppercase">
              Zoom
            </span>
          )}
          {buttons.map((b) => {
            const r = rangeFor(b);
            const active = !!r && r[0] === startDate && r[1] === endDate;
            return (
              <Button
                key={String(b)}
                type="button"
                variant="ghost"
                data-active={active}
                className={btn}
                onClick={() => r && actions.onRange(r[0], r[1])}
              >
                {b === "all" ? "All" : `${b}Y`}
              </Button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {allValues.length > 1 &&
            allValues.map((t) => (
              <Button
                key={t}
                type="button"
                variant="ghost"
                data-active={commonValue === t}
                className={btn}
                onClick={() => actions.onSetAllTransformations(t)}
              >
                {t}
              </Button>
            ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="ml-1 h-7 rounded-none px-2 text-xs shadow-none"
              >
                <Download className="size-3.5" />
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-none">
              <DropdownMenuItem onSelect={() => exportImage("png")}>
                PNG image
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportImage("jpeg")}>
                JPEG image
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportImage("svg")}>
                SVG vector image
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportImage("pdf")}>
                PDF (chart)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={exportCsv}>
                CSV (chart data)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportTable}>
                PDF (chart data table)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ChartZoomBar zoom={zoom} className="-mb-2" />
      <AnalyzerChart
        ref={chartRef}
        specs={specs}
        baseDate={baseDate}
        startDate={startDate}
        endDate={endDate}
        freq={freq}
        bounds={bounds}
        legendShowsHidden
        renderLegendControls={(s) => (
          <SeriesSettings
            spec={s}
            disableRemoveCompare={s.visible && onlyOneVisible}
            actions={actions}
          />
        )}
      />

      {sides.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 border-t pt-3">
          {sides.map((side) => {
            const ext = axisExtent(specs, rows, side);
            const minKey = `${side}Min` as keyof AxisBounds;
            const maxKey = `${side}Max` as keyof AxisBounds;
            return (
              <div key={side} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground font-semibold tracking-wider uppercase">
                  Y-Axis ({side})
                </span>
                <BoundInput
                  label="Min"
                  value={bounds[minKey]}
                  placeholder={
                    ext ? formatAxisNumber(ext[0] >= 0 ? 0 : ext[0]) : ""
                  }
                  onCommit={(v) => actions.onBound(minKey, v)}
                />
                <BoundInput
                  label="Max"
                  value={bounds[maxKey]}
                  placeholder={ext ? formatAxisNumber(ext[1]) : ""}
                  onCommit={(v) => actions.onBound(maxKey, v)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BoundInput({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: number | null;
  placeholder: string;
  onCommit: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value === null ? "" : String(value));
  }
  const commit = () => {
    const trimmed = text.trim();
    const n = trimmed === "" ? null : Number(trimmed);
    if (n !== null && !Number.isFinite(n)) {
      setText(value === null ? "" : String(value));
      return;
    }
    if (n !== value) onCommit(n);
  };
  return (
    <label className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="h-7 w-24 rounded-none px-2 text-xs tabular-nums shadow-none"
      />
    </label>
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
