import type { MlsColumnName } from "./columns";

/**
 * MLS board that issued a listing number. Numbers are unique only within a
 * board, so (board, number) is the dedup key — NOT the website we scraped.
 * The same listing seen on two sites must produce the same pair.
 */
export type MlsBoard = "HBR" | "HIS" | "RAM";

export type IslandKey =
  "oahu" | "maui" | "hawaii" | "kauai" | "molokai" | "lanai";

/** Normalized listing status, shared by every site adapter. */
export type ListingStatus =
  | "active"
  | "active_under_contract"
  | "pending"
  | "sold"
  /** The site no longer serves the listing (expired / withdrawn / cancelled). */
  | "off_market"
  | "unknown";

/**
 * Which slice of a site's inventory a list walk covers. "active" means every
 * still-open status (active, under contract, pending); "any" adds sold.
 */
export type StatusSet = "active" | "any";

export type ColumnValue = string | number | null;

/**
 * One listing in the common schema. `fields` is keyed by mls_listings column
 * name (see columns.ts); a key that is absent or null becomes SQL NULL.
 * Anything the site exposes that has no column goes in `extra`, verbatim.
 */
export interface NormalizedListing {
  mlsBoard: MlsBoard;
  mlsNumber: string;
  status: ListingStatus;
  /** Site's own status text, before normalization. */
  statusRaw: string | null;
  fields: Partial<Record<MlsColumnName, ColumnValue>>;
  extra: Record<string, string>;
}

/** What a list page tells us about a listing without fetching its detail page. */
export interface ListRow {
  mlsNumber: string;
  status: ListingStatus;
  /** Whole dollars, null when the row shows no parseable price. */
  listPrice: number | null;
}

export interface ListPageResult {
  rows: ListRow[];
  /** "Showing 1 - 20 of N" — null when the page has no result counter. */
  totalCount: number | null;
}

export interface ListQuery {
  island: IslandKey;
  statusSet: StatusSet;
  /** 1-based. */
  page: number;
}

/**
 * Everything site-specific. The pipeline, NAS cache, loader and UI only ever
 * talk to this interface; adding a site means one new directory under sites/
 * and one line in registry.ts.
 */
export interface SiteAdapter {
  /** NAS directory name and `source_site` column value, e.g. "hicentral". */
  site: string;
  /**
   * Higher wins when two sites carry the same (board, number): a lower-
   * priority site never overwrites field values written by a higher one.
   */
  priority: number;
  /**
   * Board whose numbers this site lists. A site spanning several boards
   * would need a per-row board on ListRow instead; none does yet.
   */
  board: MlsBoard;
  islands: IslandKey[];
  /** Last list page the site will serve (hicentral: 499). */
  maxPage: number;
  /** Minimum pause between requests to this site, before jitter. */
  minDelayMs: number;
  listUrl(q: ListQuery): string;
  detailUrl(mlsNumber: string): string;
  /** Pure: no network, no fs. Throws MlsParseError on an unrecognizable page. */
  parseList(html: string): ListPageResult;
  /**
   * Pure: no network, no fs. Returns null when the page is the site's
   * "listing not found / no longer available" page (hicentral serves that
   * with HTTP 200). Throws MlsParseError on any other unrecognizable page.
   */
  parseDetail(html: string): NormalizedListing | null;
}

export class MlsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MlsParseError";
  }
}
