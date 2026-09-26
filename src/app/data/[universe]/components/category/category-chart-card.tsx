"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { useAnalyzer } from "../../lib/analyzer-context";
import { formatTooltipDate } from "../../lib/dates";
import { formatNum, GROWTH_DECIMALS, seriesDecimals } from "../../lib/format";
import { usePortalConfig } from "../../lib/portal-context";
import { seriesChartData, seriesUnits } from "../../lib/series";
import type { ExpandedSeries, FreqCode, SeriesChartRow } from "../../lib/types";
import { AnalyzerToggle } from "../analyzer/analyzer-toggle";
import type { DisplayTransform } from "../selectors/transform-toggle";
import { MiniLineChart } from "../ui/mini-line-chart";
import { PortalCard } from "../ui/portal-card";

type Secondary = "yoy" | "ytd" | "c5ma";

/**
 * Label for the companion value line (highchart.formatTransformLabel):
 * c5ma → "Annual % Chg", ytd at annual → "Year/Year % Chg", ytd →
 * "Year-to-Date % Chg"; percent series drop the "%".
 */
export function secondaryLabel(
  key: Secondary,
  percent: boolean | undefined,
  freq: FreqCode,
): string {
  const chg = percent ? "Chg" : "% Chg";
  if (key === "c5ma") return `Annual ${chg}`;
  if (key === "ytd" && freq !== "A") return `Year-to-Date ${chg}`;
  return `Year/Year ${chg}`;
}

/** Last row inside [start, end] with a `key` value (highchart.findLastValue). */
function lastInRange(
  rows: SeriesChartRow[],
  key: DisplayTransform,
  start?: string,
  end?: string,
): SeriesChartRow | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (end && r.date > end) continue;
    if (start && r.date < start) break;
    if (r[key] !== null) return r;
  }
  return null;
}

/**
 * One small-multiple in the category chart grid (port of category-charts
 * cell + highchart mini chart).
 *
 * Header: series name (link), "{period}: {latest level} ({units})", and the
 * companion change ("Year-to-Date % Chg: 4.3") — the values Angular pinned in
 * its always-visible tooltip. Hovering the chart swaps those numbers for the
 * hovered point (no floating tooltip). Body: axis-less MiniLineChart over
 * [startDate, endDate]. Outlined in the brand color while in the Analyzer.
 *
 * `transform` picks what the line plots (chart-view Level/YOY/YTD toggle).
 * The header leads with that value; the second line shows level when a
 * transformation is plotted, else the configured companion change.
 *
 * Props-driven — reusable by search results or the analyzer gallery:
 *   <CategoryChartCard series={s} href={…} startDate endDate />
 * `actions` replaces the default AnalyzerToggle (analyzer passes a compare toggle).
 */
export function CategoryChartCard({
  series,
  href,
  startDate,
  endDate,
  yDomain,
  displayName,
  seasonalMessage,
  actions,
  transform = "level",
  slot = 0,
  className,
}: {
  series: ExpandedSeries;
  /** Series page link. */
  href: string;
  startDate?: string;
  endDate?: string;
  /** Shared y-range (NTA sharedYAxis). */
  yDomain?: [number, number];
  /** Defaults to title (geography name on NTA). */
  displayName?: string;
  /** When set, the card shows this message instead of the chart (SA toggle). */
  seasonalMessage?: string | null;
  actions?: React.ReactNode;
  /** Value the chart plots (default level). */
  transform?: DisplayTransform;
  slot?: number;
  className?: string;
}) {
  const { config } = usePortalConfig();
  const universe = config.universe;
  const name =
    displayName ??
    (config.categoryMode === "measurement"
      ? series.geography.name
      : series.title);
  const freq = series.frequencyShort;
  const decimals = seriesDecimals(series);
  const { miniChart } = config;
  const secondary = miniChart.showSecondary ? miniChart.secondary : null;

  const data = useMemo(() => seriesChartData(series), [series]);
  const [hovered, setHovered] = useState<SeriesChartRow | null>(null);
  const latest =
    hovered ?? lastInRange(data.rows, transform, startDate, endDate);
  const units = seriesUnits(series);
  const secondaryValue = secondary && latest ? latest[secondary] : null;
  const fmtChange = (
    key: Exclude<DisplayTransform, "level">,
    v: number | null,
  ) => formatNum(v, key === "c5ma" ? decimals : GROWTH_DECIMALS, universe);
  const levelLine = latest && (
    <>
      <span className="font-medium">
        {formatNum(latest.level, decimals, universe)}
      </span>
      {units && <span className="text-muted-foreground"> ({units})</span>}
    </>
  );

  const actionSlot = actions ?? <AnalyzerToggle seriesId={series.id} />;
  const inAnalyzer = useAnalyzer().has(series.id);
  const selectedStyle: React.CSSProperties | undefined = inAnalyzer
    ? { outline: `1px solid ${config.colors.primary}`, outlineOffset: -1 }
    : undefined;

  if (seasonalMessage) {
    return (
      <PortalCard
        className={cn("flex min-h-56 flex-col bg-neutral-50", className)}
        style={selectedStyle}
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-3">
          <h3 className="text-sm leading-tight font-semibold">{name}</h3>
          {actionSlot}
        </div>
        <p className="text-muted-foreground flex flex-1 items-center px-4 pb-4 text-sm">
          {seasonalMessage}
        </p>
      </PortalCard>
    );
  }

  return (
    <PortalCard
      className={cn("flex flex-col", className)}
      style={selectedStyle}
    >
      <header className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0 text-xs leading-snug">
          <h3 className="text-sm leading-tight font-semibold">
            <Link href={href} className="hover:underline">
              {name}
            </Link>
          </h3>
          {latest ? (
            <>
              {transform === "level" ? (
                <p className="text-foreground mt-1 tabular-nums">
                  {formatTooltipDate(latest.date, freq)}: {levelLine}
                </p>
              ) : (
                <>
                  <p className="text-foreground mt-1 tabular-nums">
                    {formatTooltipDate(latest.date, freq)}{" "}
                    <span className="text-muted-foreground">
                      {secondaryLabel(transform, series.percent, freq)}
                    </span>
                    :{" "}
                    <span className="font-medium">
                      {fmtChange(transform, latest[transform])}
                    </span>
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    Level: <span className="text-foreground">{levelLine}</span>
                  </p>
                </>
              )}
              {transform === "level" &&
                secondary &&
                secondaryValue !== null && (
                  <p className="text-muted-foreground tabular-nums">
                    {secondaryLabel(secondary, series.percent, freq)}:{" "}
                    <span className="text-foreground">
                      {fmtChange(secondary, secondaryValue)}
                    </span>
                  </p>
                )}
            </>
          ) : (
            <p className="text-muted-foreground mt-1">
              {data.dates.length
                ? `Data available from ${formatTooltipDate(
                    data.dates[0].date,
                    freq,
                  )} – ${formatTooltipDate(
                    data.dates[data.dates.length - 1].date,
                    freq,
                  )}`
                : "No data available"}
            </p>
          )}
        </div>
        <div className="-mt-1 -mr-2 shrink-0">{actionSlot}</div>
      </header>
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="mt-auto block px-2 pt-2 pb-2"
      >
        <MiniLineChart
          rows={data.rows}
          freq={freq}
          decimals={decimals}
          universe={universe}
          slot={slot}
          levelLabel={units ? `Level (${units})` : "Level"}
          companion={secondary}
          companionLabel={
            secondary
              ? secondaryLabel(secondary, series.percent, freq)
              : undefined
          }
          startDate={startDate}
          endDate={endDate}
          yDomain={yDomain}
          pseudoZones={data.pseudoZones}
          height={130}
          showXAxis={false}
          valueKey={transform}
          showYAxis={false}
          tooltip={false}
          onHoverRow={setHovered}
        />
      </Link>
    </PortalCard>
  );
}
