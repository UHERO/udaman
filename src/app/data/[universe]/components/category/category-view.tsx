"use client";

import { useCallback, useMemo, useTransition } from "react";
import Link from "next/link";
import { ChartLine, Download, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  categoryDateSpan,
  findCategoryPath,
  firstDataList,
  groupByMeasurement,
  sharedLevelExtent,
} from "../../lib/category";
import {
  buildCategoryCsv,
  buildWideTableTsv,
  downloadCsv,
} from "../../lib/csv";
import {
  createDateArray,
  rangeToParams,
  resolveDateRange,
} from "../../lib/dates";
import type { HrefParams } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import { applySeasonalDisplay, hasSeasonalSeries } from "../../lib/series";
import type { ExpandedSeries } from "../../lib/types";
import { usePortalParams } from "../../lib/use-portal-params";
import { DateRangeSlider } from "../selectors/date-range-slider";
import { endForFreqSwitch } from "../selectors/freq-switch";
import {
  CheckToggle,
  ForecastSelector,
  FreqSelector,
  GeoSelector,
  MeasurementSelector,
} from "../selectors/selectors";
import {
  availableTransforms,
  resolveDisplayTransform,
  TransformToggle,
  type TableTransform,
} from "../selectors/transform-toggle";
import { CopyButton } from "../ui/copy-button";
import { PortalCard, PortalCardHeader } from "../ui/portal-card";
import { CategoryChartCard } from "./category-chart-card";
import { CategoryHelp } from "./category-help";
import {
  buildCategoryTableRows,
  categoryCsvRows,
  CategoryTable,
} from "./category-table";
import type { CategoryTableItem } from "./category-table";
import type { CategoryPageData } from "./load-category";

/**
 * Landing / category page body (port of landing-page + category-charts +
 * category-table-view). Server data comes in as props; view, SA, table
 * transformations and the date range are URL state handled client-side with
 * shallow updates, so toggling them never refetches.
 */
export function CategoryView({ data }: { data: CategoryPageData }) {
  const { config } = usePortalConfig();
  const { category: q, setParams, href } = usePortalParams();
  const [isPending, startTransition] = useTransition();
  const universe = config.universe;
  const freq = data.freq.freq;
  const { transformations } = config;

  // ── Date grid + range (date-slider) ────────────────────────────────
  const span = useMemo(() => categoryDateSpan(data.series), [data.series]);
  const dates = useMemo(
    () => createDateArray(span.firstDate, span.endDate, freq),
    [span, freq],
  );
  const defaultRange = useMemo(
    () =>
      config.defaultRange.find((r) => r.freq === freq) ?? {
        freq,
        range: 10,
      },
    [config.defaultRange, freq],
  );
  const range = useMemo(
    () =>
      resolveDateRange({
        dates,
        freq,
        defaultRange,
        start: q.start,
        end: q.end,
      }),
    [dates, freq, defaultRange, q.start, q.end],
  );

  // ── Seasonal display per measurement group ────────────────────────
  const hasSeasonal = useMemo(
    () => hasSeasonalSeries(data.series),
    [data.series],
  );
  const items = useMemo<CategoryTableItem[]>(
    () =>
      groupByMeasurement(data.series)
        .flatMap((g) => applySeasonalDisplay(g.series, q.sa, hasSeasonal))
        .filter((r) => r.display || r.seasonalMessage),
    [data.series, q.sa, hasSeasonal],
  );
  const saMessage = `Data only available as ${
    q.sa ? "non-seasonally adjusted" : "seasonally adjusted"
  }.`;

  // ── Navigation ─────────────────────────────────────────────────────
  /** Server-backed change (new geo/freq/fc/measurement): push + refetch. */
  const navigate = useCallback(
    (updates: HrefParams) =>
      startTransition(() => setParams(updates, { mode: "push" })),
    [setParams],
  );
  /** Client-only change (view, SA, table rows, range): no refetch. */
  const shallow = useCallback(
    (updates: HrefParams) => setParams(updates, { mode: "shallow" }),
    [setParams],
  );

  const seriesHref = useCallback(
    (s: ExpandedSeries) =>
      href("series", { id: s.id, data_list_id: data.dataList.id }, true),
    [href, data.dataList.id],
  );

  const view = q.view;
  const showYtd = transformations.ytd && freq !== "A";
  const transforms = availableTransforms(transformations, freq);
  const chartTransform = resolveDisplayTransform(q.transform, transforms);
  const tableTransforms = transforms.filter((t) => q[t]);
  const setTableTransforms = (on: TableTransform[]) =>
    shallow({
      yoy: on.includes("yoy") || null,
      ytd: on.includes("ytd") || null,
      c5ma: on.includes("c5ma") || null,
    });

  const visibleDates = useMemo(
    () => dates.slice(range.startIndex, range.endIndex + 1),
    [dates, range.startIndex, range.endIndex],
  );

  const tableRows = useMemo(
    () =>
      view === "table"
        ? buildCategoryTableRows(items, {
            universe,
            yoy: transformations.yoy && q.yoy,
            ytd: showYtd && q.ytd,
            c5ma: transformations.c5ma && q.c5ma,
          })
        : [],
    [view, items, universe, transformations, showYtd, q.yoy, q.ytd, q.c5ma],
  );

  const yDomain = useMemo<[number, number] | undefined>(() => {
    // Shared range is computed on level; transformed lines scale per card.
    if (
      !config.miniChart.sharedYAxis ||
      !range.startDate ||
      chartTransform !== "level"
    )
      return undefined;
    const ext = sharedLevelExtent(
      items.filter((i) => i.display).map((i) => i.series),
      range.startDate,
      range.endDate,
    );
    return ext ? [ext.min, ext.max] : undefined;
  }, [
    config.miniChart.sharedYAxis,
    items,
    range.startDate,
    range.endDate,
    chartTransform,
  ]);

  const onExport = () => {
    const { fileName, csv } = buildCategoryCsv({
      config,
      categoryId: data.category.id,
      categoryName: data.category.name,
      dataListId: data.dataList.id,
      dataListName: data.dataList.name,
      geoName: data.geo?.name ?? data.measurement?.name ?? "",
      freqLabel: data.freq.label,
      dates: visibleDates,
      rows: categoryCsvRows(tableRows),
    });
    downloadCsv(fileName, csv);
  };
  const tableTsv = () =>
    buildWideTableTsv({
      columns: visibleDates.map((d) => ({ key: d.date, label: d.tableDate })),
      rows: categoryCsvRows(tableRows),
    });

  // ── Subcategory tabs ───────────────────────────────────────────────
  const showTabs = config.categoryTabs && data.subcategories.length > 1;
  const activeTabId = useMemo(
    () => findCategoryPath(data.subcategories, data.dataList.id)[0]?.id,
    [data.subcategories, data.dataList.id],
  );

  const noData = data.series.length === 0;

  return (
    <div
      className={cn(
        "space-y-4 transition-opacity",
        isPending && "pointer-events-none opacity-60",
      )}
      aria-busy={isPending}
    >
      <div>
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-(--portal-primary)">
            {data.category.name}
          </h1>
          <CategoryHelp />
        </div>
        {showTabs ? (
          <nav
            aria-label="Subcategories"
            className="border-border mt-2 flex flex-wrap gap-x-5 border-b"
          >
            {data.subcategories.map((sub) => {
              const active = sub.id === activeTabId;
              return (
                <Link
                  key={sub.id}
                  href={href(
                    "category",
                    {
                      id: data.category.id,
                      data_list_id: firstDataList(sub).id,
                    },
                    true,
                  )}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px border-b-2 py-2 text-sm whitespace-nowrap",
                    active
                      ? "text-foreground border-(--portal-primary) font-medium"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  {sub.name}
                </Link>
              );
            })}
          </nav>
        ) : (
          data.dataListPath &&
          data.dataListPath !== data.category.name && (
            <h2 className="text-muted-foreground mt-1 text-sm">
              {data.dataListPath}
            </h2>
          )
        )}
      </div>

      {/* ── Toolbar (filters) ── */}
      <PortalCard className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        {(config.selectors.includes("geography") ||
          config.selectors.includes("frequency") ||
          config.selectors.includes("forecast") ||
          data.measurements) && (
          <div className="flex flex-wrap items-center gap-2">
            {config.selectors.includes("geography") && data.geos.length > 0 && (
              <GeoSelector
                geos={data.geos}
                value={data.geo?.handle}
                onChange={(g) => navigate({ geo: g.handle, freq, fc: data.fc })}
              />
            )}
            {config.selectors.includes("frequency") &&
              data.freqs.length > 0 && (
                <FreqSelector
                  freqs={data.freqs}
                  value={freq}
                  onChange={(f) =>
                    navigate({
                      freq: f.freq,
                      geo: data.geo?.handle,
                      fc: data.fc,
                      end: endForFreqSwitch(q.end, freq),
                    })
                  }
                />
              )}
            {config.selectors.includes("forecast") && data.forecasts && (
              <ForecastSelector
                forecasts={data.forecasts}
                value={data.fc}
                onChange={(fc) => navigate({ fc, geo: data.geo?.handle, freq })}
              />
            )}
            {data.measurements && data.measurements.length > 0 && (
              <MeasurementSelector
                measurements={data.measurements}
                value={data.measurement?.name}
                onChange={(m) => navigate({ m: m.name })}
              />
            )}
          </div>
        )}

        <ViewToggle view={view} onChange={(v) => shallow({ view: v })} />

        {view === "chart" ? (
          <TransformToggle
            mode="single"
            options={["level", ...transforms]}
            value={chartTransform}
            onChange={(t) => shallow({ transform: t === "level" ? null : t })}
          />
        ) : (
          <TransformToggle
            mode="multiple"
            options={transforms}
            value={tableTransforms}
            onChange={setTableTransforms}
          />
        )}

        {hasSeasonal && (
          <CheckToggle
            id="cat-sa"
            label="Seasonally Adjusted"
            checked={q.sa}
            onChange={(v) => shallow({ sa: v })}
          />
        )}

        {!noData && span.displayDateSlider && dates.length > 1 && (
          <DateRangeSlider
            className="min-w-[18rem] flex-1 basis-80"
            dates={dates}
            freq={freq}
            startIndex={range.startIndex}
            endIndex={range.endIndex}
            onChange={(r) => shallow(rangeToParams(r))}
          />
        )}
      </PortalCard>

      {/* ── Content ── */}
      {noData ? (
        <PortalCard className="text-muted-foreground px-4 py-8 text-center text-sm">
          No data available for current selection.
        </PortalCard>
      ) : view === "table" ? (
        <PortalCard>
          <PortalCardHeader
            title={data.dataList.name}
            subtitle={[
              data.geo?.name ?? data.measurement?.name,
              data.freq.label,
            ]
              .filter(Boolean)
              .join(" · ")}
            actions={
              <>
                <CopyButton getText={tableTsv} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onExport}
                  className="h-7 rounded-none text-xs"
                >
                  <Download className="size-3.5" />
                  Download CSV
                </Button>
              </>
            }
          />
          <div className="px-4 pb-4">
            <CategoryTable
              rows={tableRows}
              dates={visibleDates}
              seriesHref={seriesHref}
              universe={universe}
              seasonalMessage={saMessage}
            />
          </div>
        </PortalCard>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {items.map((item) => (
            <CategoryChartCard
              key={item.series.id}
              series={item.series}
              href={seriesHref(item.series)}
              startDate={range.startDate}
              endDate={range.endDate}
              yDomain={yDomain}
              transform={chartTransform}
              seasonalMessage={item.seasonalMessage ? saMessage : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ViewToggle({
  view,
  onChange,
}: {
  view: "chart" | "table";
  onChange: (view: "chart" | "table") => void;
}) {
  const btn = (v: "chart" | "table", label: string, Icon: typeof ChartLine) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => view !== v && onChange(v)}
      className={cn(
        "flex h-8 items-center gap-1.5 px-3 text-sm transition-colors",
        view === v
          ? "bg-(--portal-primary) text-white"
          : "text-muted-foreground hover:text-foreground bg-white",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
  return (
    <div
      role="group"
      aria-label="View"
      className="border-input flex divide-x border"
    >
      {btn("chart", "Chart", ChartLine)}
      {btn("table", "Table", Table2)}
    </div>
  );
}
