"use client";

import { useMemo, useState } from "react";

import { getDefaultRange } from "../../lib/config";
import { formatTooltipDate, resolveDateRange } from "../../lib/dates";
import { publicPortalUrl } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import { seriesChartData, seriesUnits } from "../../lib/series";
import type { ExpandedSeries } from "../../lib/types";
import { SeriesChart } from "../series/series-chart";
import { companionsForFreq } from "../series/series-labels";

/**
 * /graph?id=… — single-series embed (Angular embed-graph → lib-highstock
 * with showTitle). Reuses workstream B's SeriesChart; the range starts at
 * the URL's start/end (default range otherwise) and the navigator lets the
 * viewer adjust it locally (the iframe URL is never rewritten).
 */
export function EmbedSeriesGraph({
  series,
  start,
  end,
}: {
  series: ExpandedSeries;
  start: string | null;
  end: string | null;
}) {
  const { config } = usePortalConfig();
  const freq = series.frequencyShort;
  const { dates, rows, pseudoZones } = useMemo(
    () => seriesChartData(series),
    [series],
  );
  const initial = useMemo(
    () =>
      resolveDateRange({
        dates,
        freq,
        defaultRange: getDefaultRange(config, freq),
        start,
        end,
      }),
    [dates, freq, config, start, end],
  );
  const [range, setRange] = useState<[number, number]>([
    initial.startIndex,
    initial.endIndex,
  ]);

  const companions = companionsForFreq(config.seriesChart.companions, freq);
  // Public URL (not absolutePortalUrl): rendered on the server too, and the
  // link leaves the iframe for the canonical portal anyway.
  const portalUrl = publicPortalUrl(config.exportLabels.publicUrl, "series", {
    id: series.id,
  });
  const first = rows[range[0]];
  const last = rows[range[1]];

  return (
    <figure className="flex min-h-0 flex-1 flex-col">
      <figcaption className="mb-2 min-w-0">
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener"
          className="text-foreground block truncate text-sm font-semibold hover:underline"
        >
          {series.title}
        </a>
        <span className="text-muted-foreground block truncate text-xs">
          {[
            series.geography?.shortName,
            series.frequency,
            seasonalText(series),
            first && last
              ? `${formatTooltipDate(first.date, freq)} – ${formatTooltipDate(last.date, freq)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </figcaption>
      <SeriesChart
        rows={rows}
        freq={freq}
        decimals={series.decimals ?? 1}
        universe={config.universe}
        percent={series.percent}
        unitsLabel={seriesUnits(series)}
        companions={companions}
        pseudoZones={pseudoZones}
        startIndex={range[0]}
        endIndex={range[1]}
        onRangeChange={(s, e) => setRange([s, e])}
        height={280}
      />
      <EmbedCredit href={portalUrl} label={config.seriesChart.credits} />
    </figure>
  );
}

function seasonalText(s: ExpandedSeries): string | null {
  if (s.seasonalAdjustment === "seasonally_adjusted")
    return "Seasonally Adjusted";
  if (s.seasonalAdjustment === "not_seasonally_adjusted")
    return "Not Seasonally Adjusted";
  return null;
}

/** Source credit (Highstock credits) linking back to the portal. */
export function EmbedCredit({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="text-muted-foreground mt-2 self-end text-[10px] hover:underline"
    >
      {label}
    </a>
  );
}
