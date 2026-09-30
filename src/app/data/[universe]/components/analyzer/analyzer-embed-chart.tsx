"use client";

import { useMemo } from "react";

import { getDefaultRange } from "../../lib/config";
import { resolveDateRange } from "../../lib/dates";
import { usePortalConfig } from "../../lib/portal-context";
import type { ExpandedSeries } from "../../lib/types";
import type { AnalyzerParams } from "../../lib/url-params";
import { AnalyzerChart } from "./analyzer-chart";
import { analyzerBase, analyzerSeriesSpecs } from "./analyzer-model";

/**
 * Read-only comparison chart for the /graph embed: the analyzer's Compare
 * chart driven entirely by analyzer params (chartSeries, yleft/yright,
 * column/area, chart* transformations, index, min/max, start/end).
 *
 *   const pkg = await fetchAnalyzerPackage({ universe, ids: q.analyzerSeries, noCache: true });
 *   // merge MOM for M/W/D (see analyzer/page.tsx loadAnalyzerSeries)
 *   <AnalyzerEmbedChart series={series} params={q} />
 */
export function AnalyzerEmbedChart({
  series,
  params,
  height = 360,
  className,
}: {
  series: ExpandedSeries[];
  params: AnalyzerParams;
  height?: number;
  className?: string;
}) {
  const { config } = usePortalConfig();
  const base = useMemo(() => analyzerBase(series), [series]);
  const freq = base.freq?.freq ?? "A";
  const range = useMemo(
    () =>
      resolveDateRange({
        dates: base.sliderDates,
        freq,
        defaultRange: getDefaultRange(config, freq),
        start: params.start,
        end: params.end,
      }),
    [base.sliderDates, freq, config, params.start, params.end],
  );
  const { specs, baseDate } = useMemo(
    () =>
      analyzerSeriesSpecs(series, params, {
        rangeStart: range.startDate || null,
        indexAllowed: base.singleFrequency,
      }),
    [series, params, range.startDate, base.singleFrequency],
  );
  return (
    <AnalyzerChart
      specs={specs}
      baseDate={baseDate}
      startDate={range.startDate}
      endDate={range.endDate}
      freq={freq}
      bounds={params}
      height={height}
      className={className}
    />
  );
}
