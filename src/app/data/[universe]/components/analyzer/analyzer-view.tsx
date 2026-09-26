"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartColumnBig, ChartLine, LayoutGrid, Trash2 } from "lucide-react";

import { fetchSeriesSiblings } from "@/actions/data-portal/portal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useAnalyzer } from "../../lib/analyzer-context";
import { getDefaultRange } from "../../lib/config";
import { rangeToParams, resolveDateRange } from "../../lib/dates";
import { usePortalConfig } from "../../lib/portal-context";
import type {
  ExpandedSeries,
  Frequency,
  TransformationDisplayName,
} from "../../lib/types";
import { analyzerParamsToQuery } from "../../lib/url-params";
import type { AnalyzerParams } from "../../lib/url-params";
import { usePortalParams } from "../../lib/use-portal-params";
import { DateRangeSlider } from "../selectors/date-range-slider";
import { endForFreqSwitch } from "../selectors/freq-switch";
import { CheckToggle, FreqSelector } from "../selectors/selectors";
import { ShareLink } from "../share/share-link";
import {
  PortalCard,
  PortalCardBody,
  PortalCardHeader,
  PortalSectionLabel,
} from "../ui/portal-card";
import type { AxisBounds } from "./analyzer-chart";
import { AnalyzerCompare } from "./analyzer-compare";
import type { CompareActions } from "./analyzer-compare";
import { AnalyzerGallery } from "./analyzer-gallery";
import { AnalyzerHelp } from "./analyzer-help";
import {
  analyzerBase,
  analyzerSeriesSpecs,
  remapIdList,
  TRANSFORMATION_PARAM,
} from "./analyzer-model";
import { AnalyzerStatsTable } from "./analyzer-stats-table";
import { AnalyzerTable } from "./analyzer-table";

const TRANSFORMATION_LISTS = [
  "chartYoy",
  "chartYtd",
  "chartMom",
  "chartC5ma",
] as const;

const PER_SERIES_LISTS = [
  "chartSeries",
  "yleft",
  "yright",
  "column",
  "area",
  ...TRANSFORMATION_LISTS,
] as const;

const without = (list: number[], id: number) => list.filter((x) => x !== id);

/**
 * The analyzer page body (Angular analyzer + analyzer.service UI state).
 *
 * `series` come from the server page (package/analyzer, MOM merged for
 * M/W/D). Everything else — comparison membership, axes, chart types,
 * transformations, index, table rows, compare/gallery, range, y bounds — is
 * URL state read through usePortalParams and written back with shallow
 * updates (Angular location.go). Changes to the series SET (remove, clear,
 * frequency switch) navigate so the server refetches.
 */
export function AnalyzerView({ series }: { series: ExpandedSeries[] }) {
  const { config } = usePortalConfig();
  const { analyzer: p, setParams } = usePortalParams();
  const { remove, clear } = useAnalyzer();
  const universe = config.universe;

  const base = useMemo(() => analyzerBase(series), [series]);
  const freq = base.freq?.freq ?? "A";

  const range = useMemo(
    () =>
      resolveDateRange({
        dates: base.sliderDates,
        freq,
        defaultRange: getDefaultRange(config, freq),
        start: p.start,
        end: p.end,
      }),
    [base.sliderDates, freq, config, p.start, p.end],
  );

  const { specs, baseDate, indexed } = useMemo(
    () =>
      analyzerSeriesSpecs(series, p, {
        rangeStart: range.startDate || null,
        indexAllowed: base.singleFrequency,
      }),
    [series, p, range.startDate, base.singleFrequency],
  );
  const visibleIds = specs.filter((s) => s.visible).map((s) => s.id);

  /** Shallow-write a subset of analyzer params (only the given keys). */
  const write = useCallback(
    (updates: Partial<AnalyzerParams>) => {
      const q = analyzerParamsToQuery(updates);
      const picked = Object.fromEntries(
        Object.keys(updates).map((k) => [k, q[k]]),
      );
      setParams(picked, { mode: "shallow" });
    },
    [setParams],
  );

  const actions: CompareActions = {
    onRange: (startDate, endDate) =>
      setParams(
        rangeToParams({
          startDate,
          endDate,
          useDefaultRange: false,
          endOfSample:
            endDate === base.sliderDates[base.sliderDates.length - 1]?.date,
        }),
        { mode: "shallow" },
      ),
    onSetAxis: (id, side) =>
      write({
        yleft:
          side === "left"
            ? [...without(p.yleft, id), id]
            : without(p.yleft, id),
        yright:
          side === "right"
            ? [...without(p.yright, id), id]
            : without(p.yright, id),
      }),
    onSetType: (id, type) =>
      write({
        column:
          type === "column"
            ? [...without(p.column, id), id]
            : without(p.column, id),
        area:
          type === "area" ? [...without(p.area, id), id] : without(p.area, id),
      }),
    onSetTransformation: (id, t) => {
      const next: Partial<AnalyzerParams> = {};
      for (const k of TRANSFORMATION_LISTS) next[k] = without(p[k], id);
      if (t !== "Level") {
        const k = TRANSFORMATION_PARAM[t];
        next[k] = [...(next[k] ?? []), id];
      }
      write(next);
    },
    onSetAllTransformations: (t: TransformationDisplayName) => {
      const next: Partial<AnalyzerParams> = {
        chartYoy: [],
        chartYtd: [],
        chartMom: [],
        chartC5ma: [],
      };
      if (t !== "Level") {
        next[TRANSFORMATION_PARAM[t]] = specs
          .filter((s) => s.chartValues.includes(t))
          .map((s) => s.id);
      }
      write(next);
    },
    onToggleCompare: (id) =>
      write({
        chartSeries: visibleIds.includes(id)
          ? without(visibleIds, id)
          : [...visibleIds, id],
      }),
    onRemove: (id) => remove(id),
    onBound: (key: keyof AxisBounds, value) => write({ [key]: value }),
  };

  // ── Frequency switch (changeAnalyzerFrequency) ──────────────────
  const [switching, setSwitching] = useState(false);
  const [selectionNA, setSelectionNA] = useState(false);
  const changeFrequency = async (f: Frequency) => {
    if (f.freq === freq && base.singleFrequency) return;
    setSwitching(true);
    setSelectionNA(false);
    try {
      const results = await Promise.all(
        series.map((s) =>
          fetchSeriesSiblings({ universe, id: s.id, geo: s.geography.handle }),
        ),
      );
      const idMap = new Map<number, number>();
      series.forEach((s, i) => {
        const sibs = results[i].filter((x) => x.frequencyShort === f.freq);
        if (!sibs.length) return;
        const pick =
          sibs.find((x) => x.seasonalAdjustment === s.seasonalAdjustment) ??
          sibs[0];
        idMap.set(s.id, pick.id);
      });
      if (!idMap.size) {
        setSelectionNA(true);
        return;
      }
      const lists: Partial<AnalyzerParams> = {};
      for (const k of PER_SERIES_LISTS) {
        const src = k === "chartSeries" ? visibleIds : p[k];
        lists[k] = remapIdList(src, idMap);
      }
      const q = analyzerParamsToQuery({
        ...lists,
        analyzerSeries: remapIdList(
          series.map((s) => s.id),
          idMap,
        ),
      });
      const picked = Object.fromEntries(
        (["analyzerSeries", ...PER_SERIES_LISTS] as const).map((k) => [
          k,
          q[k],
        ]),
      );
      setParams(
        { ...picked, end: endForFreqSwitch(p.end, base.freq?.freq) },
        { mode: "push" },
      );
    } catch {
      setSelectionNA(true);
    } finally {
      setSwitching(false);
    }
  };

  const tableRows = { yoy: p.yoy, ytd: p.ytd, c5ma: p.c5ma, mom: p.mom };

  if (!series.length) {
    return (
      <PortalCard>
        <PortalCardHeader title="Analyzer" />
        <PortalCardBody className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            None of the selected series could be loaded.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none"
            onClick={clear}
          >
            Clear the analyzer
          </Button>
        </PortalCardBody>
      </PortalCard>
    );
  }

  return (
    <div
      className={cn("space-y-3", switching && "pointer-events-none opacity-60")}
    >
      <PortalCard>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
          <h1 className="text-foreground text-lg font-semibold tracking-tight">
            Analyzer
          </h1>
          <AnalyzerHelp />
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-none px-2.5 text-xs"
              onClick={() => write({ compare: !p.compare })}
            >
              {p.compare ? (
                <>
                  <LayoutGrid className="size-3.5" /> Gallery View
                </>
              ) : (
                <>
                  <ChartColumnBig className="size-3.5" /> Compare
                </>
              )}
            </Button>
            <ShareLink
              view="analyzer"
              analyzerParams={{
                ...p,
                analyzerSeries: series.map((s) => s.id),
                chartSeries: visibleIds,
              }}
              start={p.start}
              end={p.end}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-3 pb-3">
          {base.siblingFreqs.length > 0 && (
            <FreqSelector
              freqs={base.siblingFreqs}
              value={base.singleFrequency ? freq : null}
              placeholder="Select a single frequency"
              onChange={(f) => void changeFrequency(f)}
            />
          )}
          <span
            title={
              base.singleFrequency
                ? undefined
                : "Unavailable for mixed frequencies"
            }
          >
            <CheckToggle
              id="analyzer-index"
              label={indexed && baseDate ? `Index (${baseDate})` : "Index"}
              checked={indexed}
              onChange={(v) => write({ index: v })}
              className={cn(
                !base.singleFrequency && "pointer-events-none opacity-50",
              )}
            />
          </span>
          <DateRangeSlider
            dates={base.sliderDates}
            freq={freq}
            startIndex={range.startIndex}
            endIndex={range.endIndex}
            onChange={(r) => actions.onRange(r.startDate, r.endDate)}
            className="min-w-[18rem] flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clear}
            className="text-destructive hover:text-destructive h-8 rounded-none px-2.5 text-xs"
          >
            <Trash2 className="size-3.5" />
            Remove All Series
          </Button>
        </div>
        {selectionNA && (
          <p className="text-destructive px-4 pb-3 text-sm">
            Selection not available.
          </p>
        )}
      </PortalCard>

      {p.compare ? (
        <PortalCard>
          <PortalCardBody className="pt-3">
            <AnalyzerCompare
              specs={specs}
              baseDate={baseDate}
              freq={freq}
              sliderDates={base.sliderDates}
              startDate={range.startDate}
              endDate={range.endDate}
              bounds={{
                leftMin: p.leftMin,
                leftMax: p.leftMax,
                rightMin: p.rightMin,
                rightMax: p.rightMax,
              }}
              actions={actions}
            />
          </PortalCardBody>
        </PortalCard>
      ) : (
        <AnalyzerGallery
          specs={specs}
          startDate={range.startDate}
          endDate={range.endDate}
          indexed={indexed}
          baseDate={baseDate}
          onToggleCompare={actions.onToggleCompare}
          onRemove={remove}
        />
      )}

      <PortalCard>
        <PortalCardHeader title="Data" />
        <PortalCardBody>
          <AnalyzerTable
            series={series}
            freq={freq}
            startDate={range.startDate}
            endDate={range.endDate}
            indexed={indexed}
            baseDate={baseDate}
            rows={tableRows}
            onToggleRow={(k, v) => write({ [k]: v })}
          />
        </PortalCardBody>
      </PortalCard>

      <PortalCard>
        <PortalCardHeader title="Summary Statistics" />
        <PortalCardBody>
          <AnalyzerStatsTable
            series={series}
            startDate={range.startDate}
            endDate={range.endDate}
            indexed={indexed}
            baseDate={baseDate}
          />
        </PortalCardBody>
      </PortalCard>
    </div>
  );
}

/**
 * Nothing in the URL. If the session still holds a selection (the analyzer
 * link lost its params, e.g. a bookmark of bare /analyzer), restore it;
 * otherwise explain how to add series.
 */
export function AnalyzerEmpty() {
  const { ids, analyzerHref } = useAnalyzer();
  const router = useRouter();
  useEffect(() => {
    if (ids.length) router.replace(analyzerHref);
  }, [ids.length, analyzerHref, router]);

  return (
    <PortalCard>
      <div className="flex items-center gap-2 px-4 pt-3">
        <h1 className="text-foreground text-lg font-semibold tracking-tight">
          Analyzer
        </h1>
        <AnalyzerHelp />
      </div>
      <PortalCardBody className="max-w-2xl space-y-3 pt-2 text-sm">
        <PortalSectionLabel>No series selected</PortalSectionLabel>
        <p>
          The Analyzer compares indicators side by side: small charts in the
          Gallery view, a single chart with left and right axes in the Compare
          view, and a data table with summary statistics you can download as
          CSV.
        </p>
        <p className="text-muted-foreground flex flex-wrap items-center gap-1">
          To add a series, click the
          <span className="bg-muted text-foreground inline-flex size-6 items-center justify-center">
            <ChartLine className="size-3.5" />
          </span>
          icon next to it on a category, series, or search results page. The
          Analyzer link in the sidebar shows how many series are selected.
        </p>
      </PortalCardBody>
    </PortalCard>
  );
}
