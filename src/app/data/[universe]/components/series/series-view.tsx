"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getDefaultRange } from "../../lib/config";
import { buildSeriesCsv, downloadCsv } from "../../lib/csv";
import { rangeToParams, resolveDateRange } from "../../lib/dates";
import { seriesDecimals } from "../../lib/format";
import { usePortalConfig } from "../../lib/portal-context";
import {
  buildSeriesTable,
  calculateSummaryStats,
  findGeoFreqSiblings,
  getTransformations,
  hasObservations,
  hasSaPair,
  selectSibling,
  seriesChartData,
  seriesUnits,
} from "../../lib/series";
import type { FreqCode, SeriesPackage, SeriesTableRow } from "../../lib/types";
import { usePortalParams } from "../../lib/use-portal-params";
import { AnalyzerToggle } from "../analyzer/analyzer-toggle";
import { exportChartImage, exportTablePdf } from "../analyzer/chart-export";
import type { ImageFormat } from "../analyzer/chart-export";
import { PortalSelect } from "../selectors/portal-select";
import { ShareLink } from "../share/share-link";
import { seriesColor } from "../ui/chart-theme";
import {
  PortalCard,
  PortalCardBody,
  PortalCardHeader,
} from "../ui/portal-card";
import { SeriesChart } from "./series-chart";
import { SeriesHelp } from "./series-help";
import {
  companionLabel,
  companionsForFreq,
  sanitizeSourceHtml,
} from "./series-labels";
import { SeriesRangeControls } from "./series-range-controls";
import { SeriesTable, seriesTableColumns } from "./series-table";
import { SummaryStatistics } from "./summary-statistics";

/** Debounce for writing brush/preset range changes to the URL. */
const URL_WRITE_DELAY = 250;

/**
 * Single-series page body (Angular single-series.component + children).
 * The package is fetched server-side; everything else — selected range,
 * sibling navigation — is URL state (start/end are written shallowly).
 */
export function SeriesView({ pkg }: { pkg: SeriesPackage }) {
  const { config } = usePortalConfig();
  const { series: query, setParams } = usePortalParams();
  const series = pkg.series;
  const freq = series.frequencyShort;
  const geo = series.geography;
  const decimals = seriesDecimals(series);
  const percent = !!series.percent;
  const hasData = hasObservations(pkg.observations);

  // ── Derived data ──────────────────────────────────────────────────
  const { dates, rows, pseudoZones } = useMemo(
    () => seriesChartData({ ...series, seriesObservations: pkg.observations }),
    [series, pkg.observations],
  );
  const tableRows = useMemo(
    () =>
      buildSeriesTable(
        dates,
        getTransformations(pkg.observations.transformationResults),
        decimals,
        series.universe,
      ),
    [dates, pkg.observations, decimals, series.universe],
  );
  const companions = companionsForFreq(config.seriesChart.companions, freq);
  const tableColumns = seriesTableColumns(config, freq, percent) as {
    key: keyof SeriesTableRow;
    label: string;
  }[];

  // ── Selectors / siblings ─────────────────────────────────────────
  const geos = series.geos?.length ? series.geos : [geo];
  const freqs = series.freqs?.length
    ? series.freqs
    : [{ freq, label: series.frequency }];
  const forecasts = pkg.forecasts ?? [];
  const showFreq = config.categoryMode !== "measurement";
  const showForecast =
    config.selectors.includes("forecast") && forecasts.length > 0;
  const currentFc =
    forecasts.find((f) => f.freq === freq && series.name.includes(f.forecast))
      ?.forecast ?? null;
  const saPair = hasSaPair(findGeoFreqSiblings(pkg.siblings, geo.handle, freq));
  const isSa = series.seasonalAdjustment === "seasonally_adjusted";

  // Per-series transient UI state (reset when the series id changes).
  const [noSelection, setNoSelection] = useState<{
    id: number;
    msg: string;
  } | null>(null);
  // Remember a frequency switch so the carried-over `end` is re-mapped
  // once (A 2015 → 2015 Q4, not Q1) — Angular's previousFreq.
  const [freqSwitch, setFreqSwitch] = useState<{
    from: FreqCode;
    to: FreqCode;
    end: string | null;
  } | null>(null);

  const goToSeries = (
    nextFreq: FreqCode,
    nextGeo: string,
    sa: boolean,
    fc: string | null,
  ) => {
    const matches = findGeoFreqSiblings(pkg.siblings, nextGeo, nextFreq, fc);
    const id = matches.length ? selectSibling(matches, sa, nextFreq) : null;
    if (!id) {
      setNoSelection({ id: series.id, msg: "Selection Not Available" });
      return;
    }
    setNoSelection(null);
    if (nextFreq !== freq) {
      setFreqSwitch({ from: freq, to: nextFreq, end: query.end });
    }
    setParams(
      {
        id,
        sa,
        fc: fc ?? null,
        geo: nextGeo,
        freq: nextFreq,
        start: query.start,
        end: query.end,
      },
      { mode: "push" },
    );
  };

  /** Forecast for a frequency: same tag if it exists there, else the first. */
  const fcForFreq = (f: FreqCode) =>
    forecasts.find((x) => x.freq === f && x.forecast === currentFc)?.forecast ??
    forecasts.find((x) => x.freq === f)?.forecast ??
    null;

  // ── Date range (URL-derived, with a pending override while dragging) ──
  const previousFreq =
    freqSwitch && freqSwitch.to === freq && freqSwitch.end === query.end
      ? freqSwitch.from
      : null;
  const resolved = useMemo(
    () =>
      resolveDateRange({
        dates,
        freq,
        defaultRange: getDefaultRange(config, freq),
        start: query.start,
        end: query.end,
        previousFreq,
      }),
    [dates, freq, config, query.start, query.end, previousFreq],
  );
  const [pending, setPending] = useState<{
    id: number;
    lo: number;
    hi: number;
  } | null>(null);
  const activePending = pending && pending.id === series.id ? pending : null;
  if (
    activePending &&
    activePending.lo === resolved.startIndex &&
    activePending.hi === resolved.endIndex
  ) {
    // URL caught up with the pending change.
    setPending(null);
  }
  const lo = activePending?.lo ?? resolved.startIndex;
  const hi = activePending?.hi ?? resolved.endIndex;
  const startDate = dates[lo]?.date ?? "";
  const endDate = dates[hi]?.date ?? "";
  const endOfSample = hi === dates.length - 1;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const changeRange = (nextLo: number, nextHi: number) => {
    setPending({ id: series.id, lo: nextLo, hi: nextHi });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setParams(
        rangeToParams({
          startDate: dates[nextLo].date,
          endDate: dates[nextHi].date,
          useDefaultRange: false,
          endOfSample: nextHi === dates.length - 1,
        }),
        { mode: "shallow" },
      );
    }, URL_WRITE_DELAY);
  };

  // Route-style start/end for share links (null = default / end of sample).
  const shareRange =
    activePending || !resolved.useDefaultRange
      ? rangeToParams({
          startDate,
          endDate,
          useDefaultRange: false,
          endOfSample,
        })
      : { start: null, end: null };

  const stats = useMemo(
    () =>
      hasData && startDate
        ? calculateSummaryStats(
            series,
            rows.map((r) => ({ date: r.date, value: r.level })),
            startDate,
            endDate,
          )
        : null,
    [hasData, series, rows, startDate, endDate],
  );

  const exportCsv = () => {
    const { fileName, csv } = buildSeriesCsv({
      series,
      config,
      rows: rows.slice(lo, hi + 1),
      columns: [
        { key: "level", label: "Level" },
        ...companions.map((c) => ({
          key: c,
          label: companionLabel(c, percent),
        })),
      ],
    });
    downloadCsv(fileName, csv);
  };

  const noSelectionMsg =
    noSelection && noSelection.id === series.id ? noSelection.msg : null;
  const seasonalText =
    series.seasonalAdjustment === "seasonally_adjusted"
      ? "Seasonally adjusted"
      : series.seasonalAdjustment === "not_seasonally_adjusted"
        ? "Not seasonally adjusted"
        : null;
  const units = series.unitsLabel || series.unitsLabelShort || "";

  // ── Exports (CSV / chart image + PDF / table PDF) ─────────────────
  const plotRef = useRef<HTMLDivElement>(null);
  const exportName = `${series.name || "series"}`.replace(/[^\w.@-]+/g, "_");
  const exportSubtitle = [
    units,
    geo.name,
    series.frequency,
    seasonalText,
    `${dates[lo]?.tableDate ?? ""} – ${dates[hi]?.tableDate ?? ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const exportSource = [
    series.sourceDescription
      ? `Source: ${series.sourceDescription}${series.sourceLink ? ` (${series.sourceLink})` : ""}`
      : "",
    config.exportLabels.portal,
    config.exportLabels.portalLink,
  ];
  const exportImage = (format: ImageFormat) => {
    if (!plotRef.current) return;
    const barKey = companions[0];
    void exportChartImage(plotRef.current, format, exportName, {
      leftTitle: barKey ? companionLabel(barKey, percent) : undefined,
      rightTitle: units || undefined,
      legend: [
        {
          color: seriesColor(config, 0),
          label: units ? `Level (${units})` : "Level",
        },
        ...(barKey
          ? [
              {
                color: config.colors.chartMuted,
                label: companionLabel(barKey, percent),
                kind: "bar" as const,
              },
            ]
          : []),
      ],
      credits: config.seriesChart.credits,
      title: series.title,
      subtitle: exportSubtitle,
      source: exportSource,
    });
  };
  const exportTable = () => {
    const visibleRows = tableRows.slice(lo, hi + 1).reverse();
    void exportTablePdf({
      fileName: exportName,
      title: series.title,
      subtitle: exportSubtitle,
      head: ["Date", ...tableColumns.map((c) => c.label)],
      body: visibleRows.map((r) => [
        r.tableDate,
        ...tableColumns.map((c) => String(r[c.key] ?? "")),
      ]),
      footer: exportSource,
    });
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {/* ── Title + selectors ─────────────────────────────────────── */}
      <PortalCard>
        <div className="px-4 pt-4 pb-3 md:px-5">
          <div className="flex items-start gap-2">
            <h1
              className="min-w-0 text-xl leading-tight font-semibold tracking-wide md:text-2xl"
              style={{ color: "var(--portal-primary)" }}
            >
              {series.title}
            </h1>
            <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
              <AnalyzerToggle seriesId={series.id} />
              <SeriesHelp />
            </div>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {[units, geo.name, series.frequency, seasonalText]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {series.description && (
            <p className="text-foreground/80 mt-2 max-w-3xl text-sm">
              {series.description}
            </p>
          )}
        </div>
        <div className="border-border flex flex-wrap items-center gap-2 border-t px-4 py-2.5 md:px-5">
          {geos.length > 0 && (
            <PortalSelect
              ariaLabel="Geography"
              value={geo.handle}
              options={geos.map((g) => ({ value: g.handle, label: g.name }))}
              onChange={(handle) =>
                goToSeries(freq, handle, query.sa, currentFc)
              }
            />
          )}
          {showFreq && freqs.length > 0 && (
            <PortalSelect
              ariaLabel="Frequency"
              value={freq}
              options={freqs.map((f) => ({ value: f.freq, label: f.label }))}
              onChange={(f) =>
                goToSeries(
                  f as FreqCode,
                  geo.handle,
                  query.sa,
                  showForecast ? fcForFreq(f as FreqCode) : null,
                )
              }
            />
          )}
          {showForecast && (
            <PortalSelect
              ariaLabel="Forecast"
              value={currentFc ? `${currentFc}|${freq}` : undefined}
              placeholder="Forecast"
              options={forecasts.map((f) => ({
                value: `${f.forecast}|${f.freq}`,
                label: forecasts.some(
                  (o) => o.forecast === f.forecast && o.freq !== f.freq,
                )
                  ? `${f.forecast} (${f.label})`
                  : f.forecast,
              }))}
              onChange={(v) => {
                const [fc, f] = v.split("|") as [string, FreqCode];
                goToSeries(f, geo.handle, query.sa, fc);
              }}
            />
          )}
          {saPair && (
            <label className="flex items-center gap-2 px-1 text-sm">
              <Checkbox
                checked={isSa}
                onCheckedChange={(v) =>
                  goToSeries(freq, geo.handle, v === true, currentFc)
                }
                className="rounded-none data-[state=checked]:border-(--portal-primary) data-[state=checked]:bg-(--portal-primary) data-[state=checked]:text-white"
              />
              Seasonally Adjusted
            </label>
          )}
          <div className="ml-auto">
            <ShareLink
              view="series"
              seriesId={series.id}
              seasonallyAdjusted={query.sa}
              start={shareRange.start}
              end={shareRange.end}
            />
          </div>
        </div>
        {noSelectionMsg && (
          <p className="border-border text-destructive border-t px-4 py-2 text-sm md:px-5">
            {noSelectionMsg}
          </p>
        )}
      </PortalCard>

      {!hasData ? (
        <PortalCard>
          <PortalCardBody className="text-muted-foreground py-10 text-center text-sm">
            Data not available
          </PortalCardBody>
          <SourceBlock series={series} />
        </PortalCard>
      ) : noSelectionMsg ? null : (
        <>
          {/* ── Chart ─────────────────────────────────────────────── */}
          <PortalCard>
            <div className="flex flex-wrap items-center gap-3 px-4 pt-3 pb-2 md:px-5">
              <SeriesRangeControls
                className="min-w-0 flex-1"
                dates={dates}
                freq={freq}
                buttons={config.seriesChart.rangeButtons}
                startIndex={lo}
                endIndex={hi}
                onChange={changeRange}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-none px-2.5 text-xs shadow-none"
                  >
                    <Download className="size-3.5" />
                    Download
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-none">
                  <DropdownMenuItem onSelect={() => exportImage("png")}>
                    PNG image
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportImage("svg")}>
                    SVG vector image
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportImage("pdf")}>
                    PDF (chart)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={exportCsv}>
                    CSV (data)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={exportTable}>
                    PDF (data table)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <PortalCardBody className="md:px-5">
              <SeriesChart
                rows={rows}
                freq={freq}
                decimals={decimals}
                universe={series.universe}
                percent={percent}
                unitsLabel={units}
                companions={companions}
                pseudoZones={pseudoZones}
                startIndex={lo}
                endIndex={hi}
                onRangeChange={changeRange}
                plotRef={plotRef}
              />
            </PortalCardBody>
            <SourceBlock series={series} />
          </PortalCard>

          {/* ── Summary statistics ───────────────────────────────── */}
          {stats && (
            <PortalCard>
              <PortalCardHeader title="Summary Statistics" />
              <PortalCardBody>
                <SummaryStatistics
                  stats={stats}
                  unitsShort={series.unitsLabelShort || undefined}
                  percent={percent}
                />
              </PortalCardBody>
            </PortalCard>
          )}

          {/* ── Data table ───────────────────────────────────────── */}
          <PortalCard>
            <PortalCardHeader
              title="Data"
              subtitle={`${seriesUnits(series)}${seriesUnits(series) ? " · " : ""}${dates[lo]?.tableDate ?? ""} – ${dates[hi]?.tableDate ?? ""}`}
            />
            <PortalCardBody>
              <SeriesTable
                rows={tableRows}
                columns={tableColumns}
                startIndex={lo}
                endIndex={hi}
              />
            </PortalCardBody>
          </PortalCard>
        </>
      )}
    </div>
  );
}

/** Source description, link and notes (below the chart in Angular). */
function SourceBlock({ series }: { series: SeriesPackage["series"] }) {
  const { sourceDescription, sourceLink, sourceDetails } = series;
  if (!sourceDescription && !sourceLink && !sourceDetails) return null;
  return (
    <footer className="border-border text-muted-foreground border-t px-4 py-3 text-xs leading-relaxed md:px-5">
      <span className="text-foreground/70 mr-1 font-semibold tracking-wider uppercase">
        Source
      </span>
      {sourceDescription}
      {sourceLink && (
        <>
          {sourceDescription ? " · " : ""}
          <a
            href={sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all underline-offset-2 hover:underline"
            style={{ color: "var(--portal-primary)" }}
          >
            {sourceLink}
          </a>
        </>
      )}
      {sourceDetails && (
        <div
          className="mt-1 [&_a]:underline"
          dangerouslySetInnerHTML={{
            __html: sanitizeSourceHtml(sourceDetails),
          }}
        />
      )}
    </footer>
  );
}
