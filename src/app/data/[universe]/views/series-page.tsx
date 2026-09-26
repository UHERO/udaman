import { cache } from "react";
import type { Metadata } from "next";

import { fetchSeriesPackage } from "@/actions/data-portal/portal";

import { SeriesView } from "../components/series/series-view";
import { PortalCard, PortalCardBody } from "../components/ui/portal-card";
import { getPortalConfig } from "../lib/config";
import { pageMetadata } from "../lib/metadata";
import type { SeriesPackage } from "../lib/types";
import { parseSeriesParams } from "../lib/url-params";
import type { PortalPageProps, PortalSearchParams } from "./types";

/**
 * 'series' route — single series view (Angular single-series).
 * OWNER: workstream B.
 */

/** Deduped per request: generateMetadata and the page share one fetch. */
const loadPackage = cache(
  async (
    universe: string,
    id: number | null,
    categoryId: number | null,
    noCache: boolean,
  ): Promise<SeriesPackage | null> => {
    if (!id) return null;
    try {
      return await fetchSeriesPackage({ universe, id, categoryId, noCache });
    } catch (e) {
      // Nonexistent ids come back as HTTP 500 → "Series does not exist."
      console.error("data portal: package/series failed", e);
      return null;
    }
  },
);

function packageFor(universe: string, searchParams: PortalSearchParams) {
  const q = parseSeriesParams(searchParams);
  return loadPackage(universe, q.id, q.data_list_id, q.nocache);
}

/** Title = series title; description adds region, frequency and portal. */
export async function seriesMetadata(
  universe: string,
  searchParams: PortalSearchParams,
): Promise<Metadata> {
  const pkg = await packageFor(universe, searchParams);
  const series = pkg?.series;
  if (!series)
    return pageMetadata(universe, { title: "Series", route: "series" });
  const config = getPortalConfig(universe);
  const where = [series.geography?.name, series.frequency]
    .filter(Boolean)
    .join(", ");
  return pageMetadata(universe, {
    title: series.title,
    description: `${series.title}${where ? ` (${where})` : ""}: chart, table and download from the ${config.title}.`,
    route: "series",
    params: { id: series.id },
  });
}

export async function SeriesPage({ universe, searchParams }: PortalPageProps) {
  const pkg = await packageFor(universe, searchParams);

  if (!pkg?.series) {
    return (
      <PortalCard className="mx-auto max-w-6xl">
        <PortalCardBody className="text-muted-foreground py-10 text-center text-sm">
          Series does not exist.
        </PortalCardBody>
      </PortalCard>
    );
  }

  return <SeriesView pkg={pkg} />;
}
