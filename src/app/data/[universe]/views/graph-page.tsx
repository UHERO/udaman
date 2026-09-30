import type { Metadata } from "next";

import {
  fetchAnalyzerMom,
  fetchAnalyzerPackage,
  fetchSeriesPackage,
} from "@/actions/data-portal/portal";

import { EmbedAnalyzerGraph } from "../components/share/embed-analyzer-graph";
import { EmbedSeriesGraph } from "../components/share/embed-series-graph";
import {
  allowMoM,
  highestFrequency,
  isSingleFrequency,
  mergeMomSeries,
} from "../lib/analyzer";
import { pageMetadata } from "../lib/metadata";
import { hasObservations } from "../lib/series";
import type { ExpandedSeries } from "../lib/types";
import { parseGraphParams } from "../lib/url-params";
import type { PortalPageProps } from "./types";

/**
 * 'graph' route — chart-only page for iframe embedding (Angular embed-graph).
 * Rendered outside the (portal) chrome: no header/sidebar.
 *
 *   /graph?id=123&start=…&end=…                  single series (noCache)
 *   /graph?analyzerSeries=1-2&chartSeries=…&…    analyzer comparison chart
 *
 * The analyzer selection provider ignores /graph, so embedding never touches
 * the viewer's own analyzer.
 * OWNER: workstream D.
 */
/** Embeds are not indexed (the canonical page is /series or /analyzer). */
export function graphMetadata(universe: string): Metadata {
  return pageMetadata(universe, {
    title: "Graph",
    route: "graph",
    noindex: true,
  });
}

export async function GraphPage({ universe, searchParams }: PortalPageProps) {
  const query = parseGraphParams(searchParams);

  let body: React.ReactNode = <Message>No series selected.</Message>;

  if (query.id) {
    try {
      const pkg = await fetchSeriesPackage({
        universe,
        id: query.id,
        noCache: true,
      });
      if (!hasObservations(pkg.observations)) {
        body = <Message>Data not available.</Message>;
      } else {
        const series: ExpandedSeries = {
          ...pkg.series,
          seriesObservations: pkg.observations,
        };
        body = (
          <EmbedSeriesGraph
            series={series}
            start={query.start}
            end={query.end}
          />
        );
      }
    } catch (e) {
      console.error("data portal embed: series fetch failed", e);
      body = <Message>Series not found.</Message>;
    }
  } else if (query.analyzerSeries.length) {
    try {
      const pkg = await fetchAnalyzerPackage({
        universe,
        ids: query.analyzerSeries,
        noCache: true,
      });
      // Keep no-data series: palette slots follow analyzer position.
      let series = pkg.series;
      const freq = isSingleFrequency(series)
        ? series[0]?.frequencyShort
        : highestFrequency(series)?.freq;
      if (allowMoM(freq)) {
        try {
          const mom = await fetchAnalyzerMom({
            universe,
            ids: query.analyzerSeries,
            noCache: true,
          });
          series = mergeMomSeries(series, mom.series);
        } catch (e) {
          console.error("data portal embed: analyzermom failed", e);
        }
      }
      // Keep the URL's analyzer order.
      const order = new Map(query.analyzerSeries.map((id, i) => [id, i]));
      series = [...series].sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      );
      body = series.some((s) => hasObservations(s.seriesObservations)) ? (
        <EmbedAnalyzerGraph series={series} params={query} />
      ) : (
        <Message>Data not available.</Message>
      );
    } catch (e) {
      console.error("data portal embed: analyzer fetch failed", e);
      body = <Message>Series not found.</Message>;
    }
  }

  return (
    // The wrapper (views/universe-layout.tsx) is muted gray; the embed fills the iframe
    // with a plain white surface instead.
    <div className="flex min-h-svh flex-1 flex-col bg-white p-3">{body}</div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground m-auto text-sm">{children}</p>;
}
