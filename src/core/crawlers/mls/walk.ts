import { createLogger } from "@/core/observability/logger";

import type { Fetcher } from "./fetcher";
import type { IslandKey, ListRow, SiteAdapter, StatusSet } from "./types";

const log = createLogger("mls-walk");

export interface WalkResult {
  rows: Map<string, ListRow>;
  totalCount: number | null;
  /** Ran into the site's page cap (or --max-pages) with results still to come. */
  capped: boolean;
  /** Pages that never produced rows despite retries. The walk went on without them. */
  skippedPages: number[];
  /** Gave up early: too many bad pages in a row. */
  aborted: boolean;
  /** Stopped because the host asked (shutdown). */
  interrupted: boolean;
  /** Every page the site has was read: not capped, nothing skipped, not aborted. */
  complete: boolean;
}

export interface WalkCounters {
  listPages: number;
  parseFailures: number;
}

export interface WalkOptions {
  maxPages?: number;
  /** Polled before each page; true ends the walk with `interrupted`. */
  shouldStop?: () => boolean;
  sleepImpl?: (ms: number) => Promise<void>;
}

/**
 * Waits before re-requesting a list page that came back with nothing when the
 * result count said there was more. Long on purpose: the usual cause is the
 * site hiccuping (hicentral 302s to its error page), and hammering a site that
 * is erroring is the opposite of polite.
 */
export const ANOMALY_RETRY_WAITS_MS = [30_000, 120_000, 300_000];
/** Stop the walk after this many consecutive pages that stayed bad through every retry. */
export const MAX_CONSECUTIVE_BAD_PAGES = 3;

type PageOutcome =
  | { kind: "rows"; rows: ListRow[]; totalCount: number | null }
  | { kind: "nothing"; why: string; totalCount: number | null };

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Walk one island's list pages, newest first, until the site runs out.
 *
 * "Runs out" is decided by the site's own result count, never by a single
 * page looking empty. The first hicentral backfill (2026-09-20) stopped at
 * page 28 of 499 because one transient 302 was read as "past the last page"
 * and the run reported success with 4% of the listings. So: a redirect, an
 * empty page or an unparseable page before the expected last page is an
 * anomaly — retried with long waits, then skipped and recorded, and the walk
 * carries on. Only at/after the expected last page does "nothing" mean "done".
 *
 * Rows are deduped by MLS number: the result set shifts under a long walk,
 * so the same listing can show up on two pages.
 */
export async function walkList(
  adapter: SiteAdapter,
  fetcher: Fetcher,
  island: IslandKey,
  statusSet: StatusSet,
  runDate: string,
  counters: WalkCounters,
  opts: WalkOptions = {},
): Promise<WalkResult> {
  const sleep = opts.sleepImpl ?? defaultSleep;
  const rows = new Map<string, ListRow>();
  const skippedPages: number[] = [];
  let totalCount: number | null = null;
  let pageSize = 0;
  let consecutiveBad = 0;
  const lastPage = Math.min(adapter.maxPage, opts.maxPages ?? adapter.maxPage);

  const done = (
    extra: { capped?: boolean; aborted?: boolean; interrupted?: boolean } = {},
  ) => {
    const capped = extra.capped ?? false;
    const aborted = extra.aborted ?? false;
    const interrupted = extra.interrupted ?? false;
    return {
      rows,
      totalCount,
      capped,
      skippedPages,
      aborted,
      interrupted,
      complete:
        !capped && !aborted && !interrupted && skippedPages.length === 0,
    };
  };

  /** Last page the result count implies, or null before any count is known. */
  const expectedLastPage = (): number | null =>
    totalCount === null || pageSize === 0
      ? null
      : Math.max(1, Math.ceil(totalCount / pageSize));

  async function readPage(
    page: number,
    refetch: boolean,
  ): Promise<PageOutcome> {
    const q = { island, statusSet, page };
    const res = await fetcher.fetchList(adapter.listUrl(q), q, runDate, {
      refetch,
    });
    if (res.kind !== "ok") {
      const why =
        res.kind === "redirect"
          ? `redirected to ${res.location ?? "?"}`
          : `HTTP ${res.status}`;
      return { kind: "nothing", why, totalCount: null };
    }
    counters.listPages++;
    try {
      const parsed = adapter.parseList(res.html);
      return parsed.rows.length > 0
        ? { kind: "rows", rows: parsed.rows, totalCount: parsed.totalCount }
        : { kind: "nothing", why: "no rows", totalCount: parsed.totalCount };
    } catch (err) {
      counters.parseFailures++;
      log.error(
        { island, page, path: res.path, err },
        "List page failed to parse",
      );
      return { kind: "nothing", why: "unparseable", totalCount: null };
    }
  }

  for (let page = 1; page <= lastPage; page++) {
    if (opts.shouldStop?.()) return done({ interrupted: true });
    let outcome = await readPage(page, false);

    for (
      let retry = 0;
      outcome.kind === "nothing" && retry < ANOMALY_RETRY_WAITS_MS.length;
      retry++
    ) {
      totalCount = outcome.totalCount ?? totalCount;
      // An island with no listings at all, or the last page having emptied
      // out while we walked: a legitimate end.
      if (totalCount === 0) return done();
      const expected = expectedLastPage();
      if (expected !== null && page >= expected) return done();

      const waitMs = ANOMALY_RETRY_WAITS_MS[retry];
      log.warn(
        { island, page, why: outcome.why, expectedLastPage: expected, waitMs },
        "List page came back with nothing before the expected last page — retrying",
      );
      await sleep(waitMs);
      outcome = await readPage(page, true);
    }

    if (outcome.kind === "nothing") {
      totalCount = outcome.totalCount ?? totalCount;
      if (totalCount === 0) return done();
      const expected = expectedLastPage();
      if (expected !== null && page >= expected) return done();

      skippedPages.push(page);
      consecutiveBad++;
      log.error(
        { island, page, why: outcome.why, consecutiveBad },
        "List page skipped after retries",
      );
      if (consecutiveBad >= MAX_CONSECUTIVE_BAD_PAGES) {
        return done({ aborted: true });
      }
      continue;
    }

    consecutiveBad = 0;
    totalCount = outcome.totalCount ?? totalCount;
    pageSize = Math.max(pageSize, outcome.rows.length);
    for (const row of outcome.rows) rows.set(row.mlsNumber, row);

    const expected = expectedLastPage();
    if (expected !== null && page >= expected) return done();
    if (page % 25 === 0) {
      log.info(
        { island, page, expectedLastPage: expected, listings: rows.size },
        "List walk progress",
      );
    }
  }

  // Out of pages with results still to come (hicentral: 499 × 20 of 20k).
  return done({ capped: true });
}
