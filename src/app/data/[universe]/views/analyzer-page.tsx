import type { Metadata } from "next";

import {
  AnalyzerEmpty,
  AnalyzerView,
} from "../components/analyzer/analyzer-view";
import { loadAnalyzerSeries } from "../components/analyzer/load-analyzer-series";
import {
  PortalCard,
  PortalCardBody,
  PortalCardHeader,
} from "../components/ui/portal-card";
import { pageMetadata } from "../lib/metadata";
import type { ExpandedSeries } from "../lib/types";
import { parseAnalyzerParams } from "../lib/url-params";
import type { PortalPageProps } from "./types";

/**
 * 'analyzer' route (Angular analyzer + analyzer.service data loading).
 * Series are fetched here from `analyzerSeries`; all other analyzer state is
 * URL-driven on the client (components/analyzer/analyzer-view.tsx).
 */
export function analyzerMetadata(universe: string): Metadata {
  return pageMetadata(universe, { title: "Analyzer", route: "analyzer" });
}

export async function AnalyzerPage({
  universe,
  searchParams,
}: PortalPageProps) {
  const query = parseAnalyzerParams(searchParams);

  if (!query.analyzerSeries.length) return <AnalyzerEmpty />;

  let series: ExpandedSeries[];
  try {
    series = await loadAnalyzerSeries({
      universe,
      ids: query.analyzerSeries,
      noCache: query.nocache,
    });
  } catch {
    return (
      <PortalCard>
        <PortalCardHeader title="Analyzer" />
        <PortalCardBody className="text-muted-foreground text-sm">
          The analyzer data could not be loaded. Please try again later.
        </PortalCardBody>
      </PortalCard>
    );
  }

  return <AnalyzerView series={series} />;
}
