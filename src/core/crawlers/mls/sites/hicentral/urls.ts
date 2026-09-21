import type { IslandKey, ListQuery, StatusSet } from "../../types";

/**
 * HiCentral encodes search criteria as slash-delimited POSITIONAL segments
 * inside the query string, so URLs are built from a segment array and joined
 * once — never by string concatenation. Splitting the part after `?` on `/`:
 *
 *   0 ""   1 Results   2 Neighborhood   3 sort   4 page   5 "7"   6 ""   7 status   8… island tail
 *
 * A value in the wrong slot (sort in the page segment, say) is answered with a
 * 302 to /PropertySearch/Error.aspx, not an error page.
 */

const BASE = "https://propertysearch.hicentral.com/HBR/ForSale/";

/** Segment 3. `""` = price high→low (site default), `pl` = price low→high, `d` = newest. */
export type HicentralSort = "" | "pl" | "d";

/** Segment 7 bitmask, read off the site's own status <select>. */
export const HICENTRAL_STATUS = {
  active: 128,
  activeUnderContract: 16,
  pending: 1,
  sold: 256,
  any: 401,
} as const;

/**
 * The "active" set is every status that is still open — Active, Active Under
 * Contract and Pending (145; verified 2026-09-18: 4,667 = 3,630 + 867 + 170).
 * Under-contract and pending listings never appear in a 128-only list, so
 * walking just 128 would leave their status changes (and eventual sale) to be
 * discovered one detail page at a time. Walking 145 costs ~50 more list pages
 * a day and makes "absent from today's walk" mean sold or withdrawn.
 */
const STATUS_FOR_SET: Record<StatusSet, number> = {
  active:
    HICENTRAL_STATUS.active |
    HICENTRAL_STATUS.activeUnderContract |
    HICENTRAL_STATUS.pending,
  any: HICENTRAL_STATUS.any,
  // Not walked on its own — "any" already includes sold here.
  sold: HICENTRAL_STATUS.sold,
};

/**
 * Last list page the site serves. Verified 2026-09-18: page 499 serves rows
 * 9961-9980, page 500 answers 302 → Error.aspx.
 */
export const HICENTRAL_MAX_PAGE = 499;

/**
 * Everything after the status segment, per island, copied verbatim from the
 * handoff seed URLs. Each starts with the "/" that separates it from status.
 */
export const HICENTRAL_ISLAND_TAILS: Record<IslandKey, string> = {
  oahu: "////////1////////////////////////////",
  kauai: "////////4/15///////////////////////////",
  maui: "////////2/19///////////////////////////",
  lanai: "////////6/28///////////////////////////",
  molokai: "////////5/96///////////////////////////",
  hawaii: "////////3////////////////////////////",
};

/** Segments 8… for an island (the tail minus its leading separator). */
function tailSegments(island: IslandKey): string[] {
  const tail = HICENTRAL_ISLAND_TAILS[island];
  if (tail === undefined)
    throw new Error(`hicentral: unknown island "${island}"`);
  return tail.split("/").slice(1);
}

/** Full segment array for a list URL. Exported for tests. */
export function listSegments(
  q: ListQuery,
  sort: HicentralSort = "d",
): string[] {
  if (!Number.isInteger(q.page) || q.page < 1 || q.page > HICENTRAL_MAX_PAGE) {
    throw new Error(
      `hicentral: page must be an integer 1..${HICENTRAL_MAX_PAGE}, got ${q.page}`,
    );
  }
  const status = STATUS_FOR_SET[q.statusSet];
  if (status === undefined) {
    throw new Error(`hicentral: unknown statusSet "${q.statusSet}"`);
  }

  return [
    "", // 0
    "Results", // 1 page type
    "Neighborhood", // 2 search type
    sort, // 3 sort
    q.page === 1 ? "" : String(q.page), // 4 page ("" = page 1)
    "7", // 5
    "", // 6
    String(status), // 7 status bitmask
    ...tailSegments(q.island), // 8…
  ];
}

/**
 * List-page URL. Always sorted `d` (newest): more stable than price sort when
 * the result set shifts underneath a long walk.
 */
export function listUrl(q: ListQuery): string {
  return `${BASE}?${listSegments(q).join("/")}`;
}

/** Detail URL. Addressable by MLS number regardless of listing status. */
export function detailUrl(mls: string): string {
  if (!/^\d{9}$/.test(mls)) {
    throw new Error(`hicentral: MLS number must be 9 digits, got "${mls}"`);
  }
  return `${BASE}?${["", mls].join("/")}`;
}
