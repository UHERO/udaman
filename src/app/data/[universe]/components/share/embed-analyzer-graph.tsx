"use client";

import { useMemo } from "react";

import { getDefaultRange } from "../../lib/config";
import { formatTooltipDate, resolveDateRange } from "../../lib/dates";
import { publicPortalUrl } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import type { ExpandedSeries } from "../../lib/types";
import { analyzerParamsToQuery } from "../../lib/url-params";
import type { GraphParams } from "../../lib/url-params";
import { AnalyzerChart } from "../analyzer/analyzer-chart";
import { analyzerBase, analyzerSeriesSpecs } from "../analyzer/analyzer-model";
import { EmbedCredit } from "./embed-series-graph";

/**
 * /graph?analyzerSeries=… — analyzer comparison chart embed (Angular
 * embed-graph → lib-analyzer-highstock). Reuses workstream C's
 * AnalyzerChart + analyzer-model, honoring chartSeries, yleft/yright,
 * left/right min/max, index, column/area and chart transformations from the
 * URL. The range is the URL's start/end (default range otherwise).
 */
export function EmbedAnalyzerGraph({
  series,
  params,
}: {
  series: ExpandedSeries[];
  params: GraphParams;
}) {
  const { config } = usePortalConfig();
  const base = useMemo(() => analyzerBase(series), [series]);
  const freq = base.freq?.freq ?? series[0].frequencyShort;

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

  const portalUrl = publicPortalUrl(
    config.exportLabels.publicUrl,
    "analyzer",
    analyzerParamsToQuery(params),
  );

  return (
    <figure className="flex min-h-0 flex-1 flex-col">
      {range.startDate && (
        <figcaption className="text-muted-foreground mb-2 text-xs">
          {formatTooltipDate(range.startDate, freq)} –{" "}
          {formatTooltipDate(range.endDate, freq)}
        </figcaption>
      )}
      <AnalyzerChart
        specs={specs}
        baseDate={baseDate}
        startDate={range.startDate || null}
        endDate={range.endDate || null}
        freq={freq}
        bounds={{
          leftMin: params.leftMin,
          leftMax: params.leftMax,
          rightMin: params.rightMin,
          rightMax: params.rightMax,
        }}
        height={320}
      />
      <EmbedCredit href={portalUrl} label={config.seriesChart.credits} />
    </figure>
  );
}
