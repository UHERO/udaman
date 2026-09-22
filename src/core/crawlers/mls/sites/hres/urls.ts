import type { IslandKey, ListQuery } from "../../types";

const ORIGIN = "https://www.hawaiirealestatesearch.com";

/**
 * Island list pages. The site has no Molokai or Lanai page — those listings
 * are carried by the `maui` walk (see hresAdapter.walkFor). `/mls/` (all
 * islands) is deliberately unused: 30 cards/page and a $50k price floor.
 */
export const HRES_ISLAND_SLUGS: Partial<Record<IslandKey, string>> = {
  oahu: "oahu",
  maui: "maui",
  hawaii: "big-island",
  kauai: "kauai",
};

/**
 * Closed-sales lists, which the island pages above do not include. Only these
 * two exist as plain sections (both HIS); /mls/hicentral_sold/ is disallowed
 * by robots.txt. 12 cards per page.
 */
export const HRES_SOLD_SLUGS: Partial<Record<IslandKey, string>> = {
  hawaii: "big-island-sold",
  kauai: "kauai_sold",
};

/**
 * Maui (RAM) has no sold section; its closings are only reachable through the
 * site's search form, filtered to Closed. 48 cards per page, ~4,900 listings
 * (2026-09-21). All property types, no price floor. The search paths that
 * robots.txt disallows are the /idx/ ones; this /mls/ one is not listed —
 * crawled on the user's say-so (2026-09-21), backfill only.
 */
export const HRES_MAUI_CLOSED_SEARCH =
  `${ORIGIN}/mls/maui/search.html?feed=maui&idx=maui&refine=true` +
  "&sortorder=DESC-timestamp_created" +
  "&search_type%5B1%5D=Homes&search_type%5B2%5D=Condos" +
  "&search_type%5B3%5D=Land&search_type%5B4%5D=Commercial" +
  "&search_status%5B0%5D=Closed";

/**
 * Safety stop only — the walk ends on an empty page / the total count long
 * before this (largest island 2026-09-19: Oahu, 120 pages of 48).
 */
export const HRES_MAX_PAGE = 400;

/**
 * List-page URL: `/mls/<slug>/`, `?p=N` from page 2 on (page 1 is the bare
 * path, which is how the site's own pagination links it).
 *
 * `statusSet` is ignored: the site only lists open listings (Active, Active
 * Under Contract), so "active" and "any" are the same walk.
 */
export function listUrl(q: ListQuery): string {
  if (!Number.isInteger(q.page) || q.page < 1 || q.page > HRES_MAX_PAGE) {
    throw new Error(
      `hres: page must be an integer 1..${HRES_MAX_PAGE}, got ${q.page}`,
    );
  }
  if (q.statusSet === "sold" && q.island === "maui") {
    return q.page === 1
      ? HRES_MAUI_CLOSED_SEARCH
      : `${HRES_MAUI_CLOSED_SEARCH}&p=${q.page}`;
  }
  const slug =
    q.statusSet === "sold"
      ? HRES_SOLD_SLUGS[q.island]
      : HRES_ISLAND_SLUGS[q.island];
  if (slug === undefined) {
    throw new Error(
      q.statusSet === "sold"
        ? `hres: no sold list for island "${q.island}" (hawaii, kauai and maui have one)`
        : `hres: no list page for island "${q.island}" (molokai/lanai are listed under maui)`,
    );
  }
  const base = `${ORIGIN}/mls/${slug}/`;
  return q.page === 1 ? base : `${base}?p=${q.page}`;
}

/**
 * Detail URL by number alone. The canonical URL carries an address slug that
 * drifts; `/listing/<mls>/` 301s to whatever the canonical page is today, so
 * the adapter sets `followRedirects`. HBR numbers are 9 digits, HIS/RAM 6.
 */
export function detailUrl(mls: string): string {
  if (!/^\d{5,9}$/.test(mls)) {
    throw new Error(`hres: MLS number must be 5-9 digits, got "${mls}"`);
  }
  return `${ORIGIN}/listing/${mls}/`;
}
