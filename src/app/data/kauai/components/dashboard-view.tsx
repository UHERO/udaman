"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, RotateCcw, X } from "lucide-react";

import { DateRangeSlider } from "@/app/data/[universe]/components/selectors/date-range-slider";
import { SegmentedToggle } from "@/app/data/[universe]/components/selectors/segmented-toggle";
import {
  PortalCard,
  PortalCardBody,
  PortalCardHeader,
} from "@/app/data/[universe]/components/ui/portal-card";
import { downloadCsv, toCsv } from "@/app/data/[universe]/lib/csv";
import { formatTooltipDate } from "@/app/data/[universe]/lib/dates";
import type { FreqCode } from "@/app/data/[universe]/lib/types";
import { cn } from "@/lib/utils";

import { findNode, FREQ_LABEL } from "../lib/categories";
import type { Category, SeriesNode } from "../lib/categories";
import type { DashboardData, DashboardSeries } from "../lib/data";
import { changeLabel, unitsText } from "../lib/theme";
import { GROWTH_PERIODS, GrowthChart } from "./growth-chart";
import { IndicatorTable, TABLE_PERIODS } from "./indicator-table";
import { JobsTreemap } from "./jobs-treemap";
import { MainChart } from "./main-chart";
import { PeriodSlider } from "./period-slider";
import { ShareDonut } from "./share-donut";

const CHART_HEIGHT = 300;

/**
 * One dashboard page (old viz.coffee render_page): toolbar, main chart +
 * time-slice panel, indicator table. Remount (key) to reset; the page keys
 * it by category + frequency so a freq switch starts fresh.
 */
export function DashboardView({
  category,
  data,
}: {
  category: Category;
  data: DashboardData;
}) {
  const [resetKey, setResetKey] = useState(0);
  return (
    <DashboardBody
      key={resetKey}
      category={category}
      data={data}
      onReset={() => setResetKey((k) => k + 1)}
    />
  );
}

/** [latest first, earliest last] shared by all series (old get_common_dates). */
function commonExtent(list: DashboardSeries[]): [number, number] {
  if (!list.length) return [0, -1];
  return [
    Math.max(...list.map((s) => s.first)),
    Math.min(...list.map((s) => s.last)),
  ];
}

function DashboardBody({
  category,
  data,
  onReset,
}: {
  category: Category;
  data: DashboardData;
  onReset: () => void;
}) {
  const { dates, freq, series } = data;
  const last = dates.length - 1;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const get = (name: string | null | undefined) =>
    (name && series[name]) || null;

  // Default chart series: first row with data.
  const defaultPrimary = useMemo(() => {
    for (const g of category.groups)
      for (const s of g.series) if (series[s.name]) return s.name;
    return null;
  }, [category, series]);

  const [primaryName, setPrimaryName] = useState(defaultPrimary);
  const [compareName, setCompareName] = useState<string | null>(null);
  const primary = get(primaryName);
  const compare = get(compareName);
  const [range, setRange] = useState<[number, number]>([
    Math.max(0, primary?.first ?? 0),
    last,
  ]);
  const [lo, hi] = range;

  // Time-slice panel: series sliced and the dates they share.
  const slice = useMemo(() => {
    const kind = category.slice;
    const names = category.sliceSeries ?? [];
    if (kind === "growth") {
      const list = names.map(get).filter((s): s is DashboardSeries => !!s);
      const [a, b] = commonExtent(list);
      return { kind, list, min: a + GROWTH_PERIODS - 1, max: b, node: null };
    }
    if (kind === "pie" || kind === "treemap") {
      const node = findNode(category, names[0]);
      const list = (node?.children ?? [])
        .map((c) => get(c.name))
        .filter((s): s is DashboardSeries => !!s);
      const [a, b] = commonExtent(list);
      return { kind, list, min: a, max: b, node };
    }
    return { kind: null, list: [], min: 0, max: last, node: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, series, last]);

  const hasSlice =
    !!slice.kind && slice.list.length > 0 && slice.max >= slice.min;
  const sliceMin = hasSlice ? slice.min : Math.min(TABLE_PERIODS - 1, last);
  const sliceMax = hasSlice ? slice.max : last;
  const [selected, setSelected] = useState(sliceMax);

  const selectPrimary = (name: string) => {
    if (name === primaryName) return;
    const s = get(name);
    if (!s) return;
    setPrimaryName(name);
    if (name === compareName) setCompareName(null);
    // Old dashboard: snap the window to the new series' sample.
    if (!compareName) setRange([s.first, last]);
  };

  const changeFreq = (f: FreqCode) =>
    startTransition(() =>
      router.push(
        f === category.defaultFreq
          ? pathname
          : `${pathname}?freq=${f.toLowerCase()}`,
        { scroll: false },
      ),
    );

  const exportCsv = () => {
    const rows: SeriesNode[] = [];
    const walk = (n: SeriesNode) => {
      rows.push(n);
      n.children?.forEach(walk);
    };
    category.groups.forEach((g) => g.series.forEach(walk));
    const cols = [...new Map(rows.map((n) => [n.name, n])).values()]
      .map((n) => get(n.name))
      .filter((s): s is DashboardSeries => !!s);
    const csv = toCsv([
      [`Kauaʻi Economic Dashboard: ${category.title} (${FREQ_LABEL[freq]})`],
      ["Source: UHERO Data Portal, data.uhero.hawaii.edu"],
      [],
      ["Date", ...cols.map((s) => `${s.label} (${unitsText(s)})`)],
      ["Series", ...cols.map((s) => `${s.name}.${freq}`)],
      ...dates.map((d, i) => [d.tableDate, ...cols.map((s) => s.lvl[i])]),
    ]);
    downloadCsv(`kauai-${category.slug}-${freq.toLowerCase()}`, csv);
  };

  const dateLabel = dates[selected]
    ? formatTooltipDate(dates[selected].date, freq)
    : "";

  if (!primary || !dates.length) {
    return (
      <PortalCard className="p-8 text-center text-sm">
        Data for {category.title} is not available right now.
      </PortalCard>
    );
  }

  return (
    <div
      className={cn(
        "space-y-4 transition-opacity",
        pending && "pointer-events-none opacity-60",
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {category.title}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Kauaʻi County · {FREQ_LABEL[freq]} data, {dates[0].tableDate}–
            {dates[last].tableDate}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {category.freqs.length > 1 && (
            <SegmentedToggle
              ariaLabel="Frequency"
              value={freq}
              options={category.freqs.map((f) => ({
                value: f,
                label: FREQ_LABEL[f] ?? f,
              }))}
              onChange={changeFreq}
            />
          )}
          <ToolbarButton onClick={exportCsv} icon={Download}>
            Export CSV
          </ToolbarButton>
          <ToolbarButton onClick={onReset} icon={RotateCcw}>
            Reset
          </ToolbarButton>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-12">
        <PortalCard className={hasSlice ? "lg:col-span-7" : "lg:col-span-12"}>
          <PortalCardHeader
            title={primary.label}
            subtitle={
              compare
                ? `Compared with ${compare.label}`
                : `${primary.units} · bars: ${changeLabel(primary.percent)}`
            }
            actions={
              compare && (
                <button
                  type="button"
                  onClick={() => setCompareName(null)}
                  className="text-muted-foreground hover:text-foreground flex h-7 items-center gap-1 px-2 text-xs hover:bg-neutral-100"
                >
                  <X className="size-3.5" /> Clear comparison
                </button>
              )
            }
          />
          <PortalCardBody>
            <MainChart
              dates={dates}
              freq={freq}
              primary={primary}
              compare={compare}
              lo={lo}
              hi={hi}
              height={CHART_HEIGHT}
            />
            <DateRangeSlider
              dates={dates}
              freq={freq}
              startIndex={lo}
              endIndex={hi}
              onChange={(r) => setRange([r.startIndex, r.endIndex])}
              className="mt-3"
            />
          </PortalCardBody>
        </PortalCard>

        {hasSlice && (
          <PortalCard className="flex flex-col lg:col-span-5">
            <PortalCardHeader
              title={
                slice.kind === "growth"
                  ? "Growth Rates"
                  : slice.kind === "pie"
                    ? "Visitor Arrivals by Market"
                    : "Nonfarm Jobs by Industry"
              }
              subtitle={
                slice.kind === "growth"
                  ? `% change from year ago, ${GROWTH_PERIODS} periods to ${dates[selected]?.tableDate}`
                  : dateLabel
              }
            />
            <PortalCardBody className="flex flex-1 flex-col justify-between gap-3">
              {slice.kind === "growth" && (
                <GrowthChart
                  dates={dates}
                  series={slice.list}
                  selected={selected}
                  height={CHART_HEIGHT - 24}
                />
              )}
              {slice.kind === "pie" && primary && (
                <ShareDonut
                  parent={get(category.sliceSeries![0]) ?? slice.list[0]}
                  parts={slice.list}
                  selected={selected}
                  dateLabel={dateLabel}
                  height={CHART_HEIGHT - 24}
                />
              )}
              {slice.kind === "treemap" && slice.node && (
                <JobsTreemap
                  root={slice.node}
                  series={series}
                  selected={selected}
                  dateLabel={dateLabel}
                  height={CHART_HEIGHT - 24}
                />
              )}
              <PeriodSlider
                dates={dates}
                min={sliceMin}
                max={sliceMax}
                value={selected}
                onChange={setSelected}
              />
            </PortalCardBody>
          </PortalCard>
        )}
      </div>

      {/* Table */}
      <PortalCard>
        <PortalCardHeader
          title="Indicators"
          subtitle={`${FREQ_LABEL[freq]} values and changes from the same period a year earlier`}
          actions={
            !hasSlice && (
              <PeriodSlider
                dates={dates}
                min={sliceMin}
                max={sliceMax}
                value={selected}
                onChange={setSelected}
                label="Through"
                className="w-72 sm:w-96"
              />
            )
          }
        />
        <PortalCardBody>
          <IndicatorTable
            category={category}
            series={series}
            dates={dates}
            freq={freq}
            lo={lo}
            hi={hi}
            selected={selected}
            primary={primary.name}
            compare={compareName}
            onSelect={selectPrimary}
            onCompare={setCompareName}
          />
        </PortalCardBody>
      </PortalCard>
    </div>
  );
}

function ToolbarButton({
  onClick,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-input text-muted-foreground hover:text-foreground flex h-8 items-center gap-1.5 border bg-white px-3 text-sm transition-colors"
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
