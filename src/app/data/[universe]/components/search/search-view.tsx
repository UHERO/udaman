"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

import { categoryDateSpan, groupByMeasurement } from "../../lib/category";
import { getDefaultRange } from "../../lib/config";
import {
  buildWideTableCsv,
  buildWideTableTsv,
  downloadCsv,
} from "../../lib/csv";
import {
  createDateArray,
  rangeToParams,
  resolveDateRange,
} from "../../lib/dates";
import { portalHref, publicPortalUrl } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import { applySeasonalDisplay, hasSeasonalSeries } from "../../lib/series";
import type { ExpandedSeries, Frequency, Geography } from "../../lib/types";
import { parseSearchTerm } from "../../lib/url-params";
import { usePortalParams } from "../../lib/use-portal-params";
import { CategoryChartCard } from "../category/category-chart-card";
import {
  buildCategoryTableRows,
  categoryCsvRows,
  CategoryTable,
} from "../category/category-table";
import type { CategoryTableItem } from "../category/category-table";
import { ViewToggle } from "../category/category-view";
import { DateRangeSlider } from "../selectors/date-range-slider";
import { endForFreqSwitch } from "../selectors/freq-switch";
import { CheckToggle, FreqSelector, GeoSelector } from "../selectors/selectors";
import {
  availableTransforms,
  resolveDisplayTransform,
  TransformToggle,
} from "../selectors/transform-toggle";
import { CopyButton } from "../ui/copy-button";
import { PortalCard, PortalCardBody } from "../ui/portal-card";

/**
 * Search matches shown like a category (landing-page with geo/freq
 * selectors, chart/table switch, YOY/YTD/SA toggles and date slider),
 * built from workstream A's props-driven pieces. `series` are the
 * package/search results for the selected geo/freq (server-resolved).
 *
 * URL state (same params as the category page): geo, freq, view, yoy, ytd,
 * sa, start, end. Geo/freq changes push (server refetch); range changes are
 * shallow.
 */
export function SearchView({
  series,
  geos,
  freqs,
  geo,
  freq,
}: {
  series: ExpandedSeries[];
  geos: Geography[];
  freqs: Frequency[];
  geo: Geography;
  freq: Frequency;
}) {
  const { config } = usePortalConfig();
  const { category: q, searchParams, setParams } = usePortalParams();
  const term = parseSearchTerm(searchParams) ?? "";
  const universe = config.universe;
  const f = freq.freq;

  // ── Dates ──────────────────────────────────────────────────────────
  const span = useMemo(() => categoryDateSpan(series), [series]);
  const dates = useMemo(
    () =>
      span.displayDateSlider
        ? createDateArray(span.firstDate, span.endDate, f)
        : [],
    [span, f],
  );
  const range = useMemo(
    () =>
      resolveDateRange({
        dates,
        freq: f,
        defaultRange: getDefaultRange(config, f),
        start: q.start,
        end: q.end,
      }),
    [dates, f, config, q.start, q.end],
  );
  const visibleDates = useMemo(
    () => dates.slice(range.startIndex, range.endIndex + 1),
    [dates, range.startIndex, range.endIndex],
  );

  // ── SA toggle per measurement group ───────────────────────────────
  const hasSeasonal = hasSeasonalSeries(series);
  const items = useMemo<CategoryTableItem[]>(
    () =>
      groupByMeasurement(series).flatMap((g) =>
        applySeasonalDisplay(g.series, q.sa, hasSeasonal),
      ),
    [series, q.sa, hasSeasonal],
  );
  const seasonalMessage = q.sa
    ? "Data only available as not seasonally adjusted."
    : "Data only available as seasonally adjusted.";

  const seriesHref = (s: ExpandedSeries) =>
    portalHref(universe, "series", {
      id: s.id,
      sa: s.seasonalAdjustment === "seasonally_adjusted",
      start: q.start,
      end: q.end,
    });

  const transforms = availableTransforms(config.transformations, f);
  const chartTransform = resolveDisplayTransform(q.transform, transforms);

  // ── Table rows ────────────────────────────────────────────────────
  const tableRows = useMemo(
    () =>
      buildCategoryTableRows(items, {
        universe,
        yoy: q.yoy && config.transformations.yoy,
        ytd: q.ytd && config.transformations.ytd && f !== "A",
        c5ma: q.c5ma && config.transformations.c5ma,
      }),
    [items, universe, q.yoy, q.ytd, q.c5ma, config.transformations, f],
  );

  const exportCsv = () => {
    const csv = buildWideTableCsv({
      columns: visibleDates.map((d) => ({ key: d.date, label: d.tableDate })),
      rows: categoryCsvRows(tableRows),
      append: [
        `Search: ${term}`,
        `${geo.name}-${freq.label}`,
        publicPortalUrl(config.exportLabels.publicUrl, "search", {
          id: term,
          geo: geo.handle,
          freq: f,
          view: "table",
        }),
      ],
    });
    downloadCsv(`search_${term}_${geo.name}-${freq.label}`, csv);
  };

  const isTable = q.view === "table";

  return (
    <>
      <PortalCard>
        <PortalCardBody className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-4">
          <GeoSelector
            geos={geos}
            value={geo.handle}
            onChange={(g) =>
              setParams({ geo: g.handle, freq: f }, { mode: "push" })
            }
          />
          <FreqSelector
            freqs={freqs}
            value={f}
            onChange={(nf) =>
              setParams(
                {
                  geo: geo.handle,
                  freq: nf.freq,
                  end: endForFreqSwitch(q.end, f),
                },
                { mode: "push" },
              )
            }
          />
          <ViewToggle
            view={isTable ? "table" : "chart"}
            onChange={(v) => setParams({ view: v })}
          />
          {isTable ? (
            <TransformToggle
              mode="multiple"
              options={transforms}
              value={transforms.filter((t) => q[t])}
              onChange={(on) =>
                setParams({
                  yoy: on.includes("yoy") || null,
                  ytd: on.includes("ytd") || null,
                  c5ma: on.includes("c5ma") || null,
                })
              }
            />
          ) : (
            <TransformToggle
              mode="single"
              options={["level", ...transforms]}
              value={chartTransform}
              onChange={(t) =>
                setParams({ transform: t === "level" ? null : t })
              }
            />
          )}
          {hasSeasonal && (
            <CheckToggle
              id="search-sa"
              label="Seasonally Adjusted"
              checked={q.sa}
              onChange={(v) => setParams({ sa: v })}
            />
          )}
          {isTable && tableRows.length > 0 && (
            <div className="ml-auto flex items-center">
              <CopyButton
                className="h-8 text-sm"
                getText={() =>
                  buildWideTableTsv({
                    columns: visibleDates.map((d) => ({
                      key: d.date,
                      label: d.tableDate,
                    })),
                    rows: categoryCsvRows(tableRows),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-none"
                onClick={exportCsv}
              >
                <Download className="size-3.5" />
                Download CSV
              </Button>
            </div>
          )}
          {dates.length > 0 && (
            <DateRangeSlider
              className="basis-full"
              dates={dates}
              freq={f}
              startIndex={range.startIndex}
              endIndex={range.endIndex}
              onChange={(r) => setParams(rangeToParams(r), { mode: "shallow" })}
            />
          )}
        </PortalCardBody>
      </PortalCard>

      {!series.length ? (
        <PortalCard>
          <PortalCardBody className="pt-4">
            <p className="text-muted-foreground text-sm">
              No data available for current selection.
            </p>
          </PortalCardBody>
        </PortalCard>
      ) : isTable ? (
        <PortalCard>
          <PortalCardBody className="pt-4">
            <CategoryTable
              rows={tableRows}
              dates={visibleDates}
              seriesHref={seriesHref}
              universe={universe}
              seasonalMessage={seasonalMessage}
              maxHeight="75vh"
            />
          </PortalCardBody>
        </PortalCard>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {items
            .filter((i) => i.display || i.seasonalMessage)
            .map(({ series: s, seasonalMessage: msg }) => (
              <CategoryChartCard
                key={s.id}
                series={s}
                href={seriesHref(s)}
                startDate={range.startDate || undefined}
                endDate={range.endDate || undefined}
                transform={chartTransform}
                seasonalMessage={msg ? seasonalMessage : null}
              />
            ))}
        </div>
      )}
    </>
  );
}
