import type { Metadata } from "next";

import {
  fetchPackageSearch,
  fetchSearchSeries,
  fetchSearchSummary,
} from "@/actions/data-portal/portal";

import { SearchResultsTable } from "../components/search/search-results-table";
import { SearchView } from "../components/search/search-view";
import {
  PortalCard,
  PortalCardBody,
  PortalCardHeader,
  PortalSectionLabel,
} from "../components/ui/portal-card";
import { resolveGeoFreq, seriesWithData } from "../lib/category";
import { pageMetadata } from "../lib/metadata";
import type {
  ExpandedSeries,
  Frequency,
  Geography,
  PortalSeries,
  SearchSummary,
} from "../lib/types";
import { parseCategoryParams, parseSearchTerm } from "../lib/url-params";
import type { PortalPageProps, PortalSearchParams } from "./types";

/**
 * 'search' route — `/search?id=<term>` (Angular param name kept; `q` also
 * accepted).
 *
 * Angular rendered search inside the landing page as a plain results table
 * (search-results, GET /search/series). Here the page shows the matches like
 * a category: GET /search gives the geos/freqs the term spans, the geo/freq
 * selection (route geo+freq if both valid, else the summary defaults) feeds
 * GET /package/search, and those series get the category chart grid / table
 * view with the date range. The full match list (all geos/freqs, ≤ 50) stays
 * below as the Angular results table.
 * OWNER: workstream D.
 */
export function searchMetadata(
  universe: string,
  searchParams: PortalSearchParams,
): Metadata {
  const term = parseSearchTerm(searchParams);
  return pageMetadata(universe, {
    title: term ? `Search: ${term}` : "Search",
    route: "search",
    params: { q: term },
  });
}

export async function SearchPage({ universe, searchParams }: PortalPageProps) {
  const sp = searchParams;
  const term = parseSearchTerm(sp);
  const query = parseCategoryParams(sp);

  if (!term) {
    return (
      <PortalCard>
        <PortalCardHeader title="Search" />
        <PortalCardBody>
          <p className="text-muted-foreground text-sm">
            Enter a search term in the search bar above.
          </p>
        </PortalCardBody>
      </PortalCard>
    );
  }

  let summary: SearchSummary | null = null;
  let results: PortalSeries[] = [];
  let error: string | null = null;
  try {
    [summary, results] = await Promise.all([
      fetchSearchSummary({ universe, q: term, noCache: query.nocache }),
      fetchSearchSeries({ universe, q: term, noCache: query.nocache }),
    ]);
  } catch (e) {
    console.error("data portal search failed", e);
    error = "Search is unavailable right now. Please try again later.";
  }

  let geos: Geography[] = [];
  let freqs: Frequency[] = [];
  let geo: Geography | null = null;
  let freq: Frequency | null = null;
  let series: ExpandedSeries[] = [];
  if (summary && summary.geos?.length && summary.freqs?.length) {
    const sel = resolveGeoFreq({
      geos: summary.geos,
      freqs: summary.freqs,
      defaults: { geo: summary.defaultGeo, freq: summary.defaultFreq },
      routeGeo: query.geo,
      routeFreq: query.freq,
    });
    ({ geos, freqs, geo, freq } = sel);
    if (geo && freq) {
      try {
        const pkg = await fetchPackageSearch({
          universe,
          q: term,
          geo: geo.handle,
          freq: freq.freq,
          noCache: query.nocache,
        });
        series = seriesWithData(pkg?.series ?? []);
      } catch (e) {
        console.error("data portal package/search failed", e);
      }
    }
  }

  const noResults = !error && !results.length && !series.length;

  return (
    <div className="flex flex-col gap-4">
      <PortalCard>
        <PortalCardHeader
          title={
            <span className="text-base">
              Search: <span className="font-normal">{term}</span>
            </span>
          }
          subtitle={
            error ??
            (noResults
              ? `No results found for ${term}`
              : `${results.length}${results.length >= 50 ? "+" : ""} matching series`)
          }
        />
      </PortalCard>

      {!error && !noResults && geo && freq && (
        <SearchView
          series={series}
          geos={geos}
          freqs={freqs}
          geo={geo}
          freq={freq}
        />
      )}

      {!error && results.length > 0 && (
        <PortalCard>
          <PortalCardHeader
            title={<PortalSectionLabel>All matching series</PortalSectionLabel>}
            subtitle="Every region and frequency"
          />
          <PortalCardBody>
            <SearchResultsTable results={results} />
          </PortalCardBody>
        </PortalCard>
      )}
    </div>
  );
}
