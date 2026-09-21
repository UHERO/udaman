import type { IslandKey, SiteAdapter } from "../../types";
import { parseDetail } from "./parse-detail";
import { parseList } from "./parse-list";
import { detailUrl, HRES_MAX_PAGE, listUrl } from "./urls";

/** Stored `island` text (lower-cased) → the list walk that would contain it. */
const WALK_FOR: ReadonlyMap<string, IslandKey> = new Map([
  ["oahu", "oahu"],
  ["maui", "maui"],
  // No Molokai / Lanai page on this site: both are listed under /mls/maui/.
  ["molokai", "maui"],
  ["lanai", "maui"],
  ["hawaii", "hawaii"],
  ["big island", "hawaii"],
  ["kauai", "kauai"],
]);

/**
 * hawaiirealestatesearch.com — a Real Estate Webmasters IDX site carrying one
 * combined feed of all three Hawaii MLSs (HBR, HIS, RAM). Server-rendered;
 * plain GETs, no session. Lower priority than HiCentral: for an HBR listing
 * both sites carry, HiCentral's richer page owns the row.
 */
export const hresAdapter: SiteAdapter = {
  site: "hres",
  priority: 50,
  boards: ["HBR", "HIS", "RAM"],
  islands: ["oahu", "maui", "hawaii", "kauai"],
  maxPage: HRES_MAX_PAGE,
  // robots.txt: `Crawl-delay: 5` for every user agent — honoured. One request
  // at a time, 5 s + jitter between them. Do not lower this.
  minDelayMs: 5000,
  // `/listing/<mls>/` and ~1/3 of list-card links 301 to the canonical slug.
  followRedirects: true,
  // A removed listing answers HTTP 404 "Listing Not Found".
  goneStatuses: [404],
  walkFor(storedIsland) {
    const key = (storedIsland ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    return WALK_FOR.get(key) ?? null;
  },
  reportsSold: false,
  soldWalkIslands: ["hawaii", "kauai"],
  listUrl,
  detailUrl,
  parseList,
  parseDetail,
};
