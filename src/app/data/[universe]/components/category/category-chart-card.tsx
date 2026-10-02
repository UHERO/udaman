"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { useAnalyzer } from "../../lib/analyzer-context";
import { formatTooltipDate } from "../../lib/dates";
import { formatNum, GROWTH_DECIMALS, seriesDecimals } from "../../lib/format";
import { usePortalConfig } from "../../lib/portal-context";
import { seriesChartData, seriesUnits } from "../../lib/series";
import type {
  ExpandedSeries,
  FreqCode,
  PseudoZone,
  SeriesChartRow,
} from "../../lib/types";
import { AnalyzerToggle } from "../analyzer/analyzer-toggle";
import type { TableTransform } from "../selectors/transform-toggle";
import { MiniLineChart } from "../ui/mini-line-chart";
import { PortalCard } from "../ui/portal-card";

/**
 * Label for the companion value line (highchart.formatTransformLabel):
 * c5ma → "Annual % Chg", ytd at annual → "Year/Year % Chg", ytd →
 * "Year-to-Date % Chg", mom → "Month/Month % Chg"; percent series drop
 * the "%".
 */
export function secondaryLabel(
  key: TableTransform,
  percent: boolean | undefined,
  freq: FreqCode,
): string {
  const chg = percent ? "Chg" : "% Chg";
  if (key === "c5ma") return `Annual ${chg}`;
  if (key === "mom") return `Month/Month ${chg}`;
  if (key === "ytd" && freq !== "A") return `Year-to-Date ${chg}`;
  return `Year/Year ${chg}`;
}

/**
 * Hover affordance: a 6px theme-color bar grows from the bottom-center out
 * to both edges. Drawn on ::after so nothing reflows and the Analyzer
 * outline (inline style) is untouched.
 */
const HOVER_BAR =
  "relative after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-1.5 after:origin-center after:scale-x-0 after:bg-(--portal-primary) after:transition-transform after:duration-200 after:ease-out after:content-[''] hover:after:scale-x-100";

/** Last row inside [start, end] with a level value (highchart.findLastValue). */
function lastInRange(
  rows: SeriesChartRow[],
  start?: string,
  end?: string,
): SeriesChartRow | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (end && r.date > end) continue;
    if (start && r.date < start) break;
    if (r.level !== null) return r;
  }
  return null;
}

/**
 * One small-multiple chart card — the category grid, search results and
 * (with `detailed`) the Analyzer gallery all use it. Port of
 * category-charts cell + highchart mini chart.
 *
 * Compact (default): series name (link), "{period}: {level} ({units})" and
 * the companion change ("Year-to-Date % Chg: 4.3") — the values Angular
 * pinned in its always-visible tooltip — over an axis-less chart.
 *
 * Detailed (Analyzer gallery): two-line title, one subtitle line
 * "geo · freq · value units (period)", and a taller chart labelled only at
 * its extremes (first/last period, min/max value).
 *
 * Either way, hovering the chart swaps the header values for the hovered
 * point (no floating tooltip; same lines, so nothing shifts), a theme bar
 * grows along the bottom edge on hover, and the card is outlined in the
 * theme color when `selected` (default: series is in the Analyzer).
 *
 * The line is always level. `growth` (chart-view YOY/YTD toggle) adds that
 * growth rate as gray bars behind it and shows it in the header.
 * `actions` replaces the default AnalyzerToggle.
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
  growth = null,
  detailed = false,
  chartData,
  valueLabel,
  emptyMessage,
  selected,
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
  /** Growth rate drawn as bars behind the level line (null = none). */
  growth?: TableTransform | null;
  /** Analyzer-gallery layout: subtitle line, taller chart, edge-only axes. */
  detailed?: boolean;
  /** Pre-transformed rows (e.g. indexed values); default from `series`. */
  chartData?: { rows: SeriesChartRow[]; pseudoZones: PseudoZone[] };
  /** Units shown with the value (default series units; "Index" when indexed). */
  valueLabel?: string;
  /** Replaces the chart with this message (e.g. no data for the base year). */
  emptyMessage?: string | null;
  /** Theme outline; defaults to "series is in the Analyzer". */
  selected?: boolean;
  slot?: number;
  className?: string;
}) {
  const { config } = usePortalConfig();
  const universe = config.universe;
  const name =
    displayName ??
    (config.categoryMode === "measurement" && !detailed
      ? series.geography.name
      : series.title);
  const freq = series.frequencyShort;
  const decimals = seriesDecimals(series);
  const { miniChart } = config;
  const secondary =
    growth ?? (miniChart.showSecondary ? miniChart.secondary : null);
  // Detailed lead line: geo · frequency · seasonal adjustment (wording from
  // Angular analyzer.service; omitted when not applicable).
  const saText =
    series.seasonalAdjustment === "seasonally_adjusted"
      ? "Seasonally Adjusted"
      : series.seasonalAdjustment === "not_seasonally_adjusted"
        ? "Not Seasonally Adjusted"
        : null;
  const leadLine = [series.geography.shortName, series.frequency, saText]
    .filter(Boolean)
    .join(" · ");
  // Detailed header always shows a growth line: the selected one, else YOY.
  const detailGrowth: TableTransform = growth ?? "yoy";

  const ownData = useMemo(() => seriesChartData(series), [series]);
  const rows = chartData?.rows ?? ownData.rows;
  const pseudoZones = chartData?.pseudoZones ?? ownData.pseudoZones;
  const [hovered, setHovered] = useState<SeriesChartRow | null>(null);
  const latest =
    hovered && hovered.level !== null
      ? hovered
      : lastInRange(rows, startDate, endDate);
  const units = valueLabel ?? seriesUnits(series);
  const secondaryValue = secondary && latest ? latest[secondary] : null;
  const fmtChange = (key: TableTransform, v: number | null) =>
    formatNum(v, key === "c5ma" ? decimals : GROWTH_DECIMALS, universe);
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
  const selectedStyle: React.CSSProperties | undefined =
    (selected ?? inAnalyzer)
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

  const chartHeight = detailed ? 150 : 130;
  const title = (
    <h3
      className={cn(
        "text-sm leading-tight font-semibold",
        detailed && "line-clamp-2",
      )}
    >
      <Link href={href} className="hover:underline" title={name}>
        {name}
      </Link>
    </h3>
  );

  return (
    <PortalCard
      className={cn("flex flex-col", HOVER_BAR, className)}
      style={selectedStyle}
    >
      <header
        className={cn(
          "flex items-start justify-between gap-2",
          detailed ? "px-3 pt-3 pb-1" : "px-4 pt-3",
        )}
      >
        {detailed ? (
          <div className="min-w-0 flex-1">
            {title}
            {/* Attributes, then value + growth lines — always rendered (an
                en dash when empty) so hovering never changes the height. */}
            <div className="mt-0.5 text-xs leading-snug">
              <p className="text-muted-foreground truncate" title={leadLine}>
                {leadLine}
              </p>
              <p className="text-foreground truncate tabular-nums">
                {latest ? (
                  <>
                    {formatTooltipDate(latest.date, freq)}: {levelLine}
                  </>
                ) : (
                  "–"
                )}
              </p>
              <p className="text-muted-foreground truncate tabular-nums">
                {secondaryLabel(detailGrowth, series.percent, freq)}:{" "}
                <span className="text-foreground">
                  {(latest && fmtChange(detailGrowth, latest[detailGrowth])) ||
                    "–"}
                </span>
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0 text-xs leading-snug">
            {title}
            {latest ? (
              <>
                <p className="text-foreground mt-1 tabular-nums">
                  {formatTooltipDate(latest.date, freq)}: {levelLine}
                </p>
                {secondary && secondaryValue !== null && (
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
                {ownData.dates.length
                  ? `Data available from ${formatTooltipDate(
                      ownData.dates[0].date,
                      freq,
                    )} – ${formatTooltipDate(
                      ownData.dates[ownData.dates.length - 1].date,
                      freq,
                    )}`
                  : "No data available"}
              </p>
            )}
          </div>
        )}
        <div
          className={cn(
            "flex shrink-0 items-center",
            !detailed && "-mt-1 -mr-2",
          )}
        >
          {actionSlot}
        </div>
      </header>
      {emptyMessage ? (
        <div
          className="text-muted-foreground mt-auto flex items-center justify-center px-2 pb-2 text-xs"
          style={{ height: chartHeight }}
        >
          {emptyMessage}
        </div>
      ) : (
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          className="mt-auto block px-2 pt-2 pb-2"
        >
          <MiniLineChart
            rows={rows}
            freq={freq}
            decimals={decimals}
            universe={universe}
            slot={slot}
            levelLabel={units ? `Level (${units})` : "Level"}
            companion={secondary}
            companionBars={!!growth}
            companionLabel={
              secondary
                ? secondaryLabel(secondary, series.percent, freq)
                : undefined
            }
            startDate={startDate}
            endDate={endDate}
            yDomain={yDomain}
            pseudoZones={pseudoZones}
            height={chartHeight}
            showXAxis={detailed}
            showYAxis={detailed}
            edgeTicks={detailed}
            tooltip={false}
            onHoverRow={setHovered}
          />
        </Link>
      )}
    </PortalCard>
  );
}
