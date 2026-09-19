import { hstToday } from "@/core/catalog/utils/time";
import { createLogger } from "@/core/observability/logger";

import { createFetcher, MlsFetchAbort } from "./fetcher";
import {
  getKnownNumbers,
  getOpenListings,
  loadListing,
  markOffMarket,
  touchSeen,
} from "./load";
import type { KnownListing, LoadOutcome } from "./load";
import { iterateCachedDetails, readHtml } from "./nas-cache";
import { getSiteAdapter } from "./registry";
import type { IslandKey, ListRow, SiteAdapter, StatusSet } from "./types";

const log = createLogger("mls-pipeline");

type Fetcher = ReturnType<typeof createFetcher>;

export interface MlsRunOptions {
  site: string;
  /** Default: every island the adapter lists. */
  islands?: IslandKey[];
  /** Stop each list walk after this many pages (smoke tests). */
  maxPages?: number;
  /** Stop after this many detail fetches+loads (smoke tests). */
  maxDetails?: number;
  /** Fetch, cache and parse as normal but write nothing to the database. */
  dryRun?: boolean;
  /** Ignore same-day cached HTML. */
  refetch?: boolean;
}

export interface MlsRunSummary {
  mode: "backfill" | "daily" | "reparse";
  site: string;
  listPages: number;
  listed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skippedLowerPriority: number;
  touched: number;
  departedChecked: number;
  offMarket: number;
  parseFailures: number;
  requests: number;
  cacheHits: number;
  /** Islands whose departed check was skipped because the walk looked wrong. */
  guardrailTripped: IslandKey[];
}

/**
 * A known, still-open listing whose list row is unchanged is re-fetched
 * anyway once its detail page is this old — list rows only expose price and
 * status, so edits to anything else would otherwise never be picked up.
 */
const REFRESH_AFTER_DAYS = 14;
/**
 * …but at most this many per run, oldest first. After the backfill every
 * listing shares one fetch date; without a cap they would all come due on
 * the same morning.
 */
const MAX_REFRESH_PER_RUN = 300;
/** Departed check is skipped for an island whose walk found under half of what we hold as open. */
const GUARDRAIL_MIN_RATIO = 0.5;
const PARSE_FAILURE_FLOOR = 5;
const PARSE_FAILURE_RATIO = 0.02;

function emptySummary(
  mode: MlsRunSummary["mode"],
  site: string,
): MlsRunSummary {
  return {
    mode,
    site,
    listPages: 0,
    listed: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skippedLowerPriority: 0,
    touched: 0,
    departedChecked: 0,
    offMarket: 0,
    parseFailures: 0,
    requests: 0,
    cacheHits: 0,
    guardrailTripped: [],
  };
}

function countOutcome(summary: MlsRunSummary, outcome: LoadOutcome): void {
  if (outcome === "inserted") summary.inserted++;
  else if (outcome === "updated") summary.updated++;
  else if (outcome === "unchanged") summary.unchanged++;
  else summary.skippedLowerPriority++;
}

interface WalkResult {
  rows: Map<string, ListRow>;
  totalCount: number | null;
  /** False when the walk was cut short (page cap, maxPages, parse failure). */
  complete: boolean;
}

/**
 * Walk one island's list pages, newest first, until the site runs out.
 * Rows are deduped by MLS number: the result set shifts under a long walk,
 * so the same listing can show up on two pages.
 */
async function walkList(
  adapter: SiteAdapter,
  fetcher: Fetcher,
  island: IslandKey,
  statusSet: StatusSet,
  runDate: string,
  summary: MlsRunSummary,
  maxPages?: number,
): Promise<WalkResult> {
  const rows = new Map<string, ListRow>();
  let totalCount: number | null = null;
  let seen = 0;
  const lastPage = Math.min(adapter.maxPage, maxPages ?? adapter.maxPage);

  for (let page = 1; page <= lastPage; page++) {
    const q = { island, statusSet, page };
    const res = await fetcher.fetchList(adapter.listUrl(q), q, runDate);
    // The site redirects to an error page past its last page.
    if (res.kind === "redirect") return { rows, totalCount, complete: true };
    summary.listPages++;

    let parsed;
    try {
      parsed = adapter.parseList(res.html);
    } catch (err) {
      summary.parseFailures++;
      log.error(
        { island, page, path: res.path, err },
        "List page failed to parse",
      );
      return { rows, totalCount, complete: false };
    }
    totalCount = parsed.totalCount ?? totalCount;
    if (parsed.rows.length === 0) return { rows, totalCount, complete: true };
    for (const row of parsed.rows) rows.set(row.mlsNumber, row);
    seen += parsed.rows.length;
    if (totalCount !== null && seen >= totalCount) {
      return { rows, totalCount, complete: true };
    }
    if (page % 25 === 0) {
      log.info(
        { island, page, listings: rows.size, totalCount },
        "List walk progress",
      );
    }
  }
  // Ran into the page cap with results still to come.
  return { rows, totalCount, complete: false };
}

type DetailResult = LoadOutcome | "gone" | "failed" | "dry";

/** Fetch one detail page (cache-through), parse it, and upsert it. */
async function fetchAndLoad(
  adapter: SiteAdapter,
  fetcher: Fetcher,
  mlsNumber: string,
  runDate: string,
  summary: MlsRunSummary,
  dryRun: boolean,
): Promise<DetailResult> {
  const url = adapter.detailUrl(mlsNumber);
  const res = await fetcher.fetchDetail(url, mlsNumber, runDate);
  if (res.kind === "redirect") {
    summary.parseFailures++;
    log.warn({ mlsNumber, location: res.location }, "Detail page redirected");
    return "failed";
  }
  let listing;
  try {
    listing = adapter.parseDetail(res.html);
  } catch (err) {
    summary.parseFailures++;
    log.error(
      { mlsNumber, path: res.path, err },
      "Detail page failed to parse",
    );
    return "failed";
  }
  if (listing === null) return "gone";
  if (listing.mlsNumber !== mlsNumber) {
    summary.parseFailures++;
    log.error(
      { requested: mlsNumber, parsed: listing.mlsNumber, path: res.path },
      "Detail page is for a different listing",
    );
    return "failed";
  }
  if (dryRun) {
    log.info(
      {
        mlsNumber,
        status: listing.status,
        listPrice: listing.fields.list_price,
      },
      "Dry run — would load",
    );
    return "dry";
  }
  const outcome = await loadListing(listing, {
    site: adapter.site,
    priority: adapter.priority,
    sourceUrl: url,
    htmlPath: res.path,
  });
  countOutcome(summary, outcome);
  return outcome;
}

/** Surface a run that "succeeded" while quietly failing to parse its pages. */
function finish(
  summary: MlsRunSummary,
  fetcher: Fetcher | null,
): MlsRunSummary {
  if (fetcher) {
    const stats = fetcher.stats();
    summary.requests = stats.requests;
    summary.cacheHits = stats.cacheHits;
  }
  log.info({ ...summary }, "MLS run summary");
  const attempted =
    summary.inserted +
    summary.updated +
    summary.unchanged +
    summary.parseFailures;
  const limit = Math.max(PARSE_FAILURE_FLOOR, attempted * PARSE_FAILURE_RATIO);
  if (summary.parseFailures > limit) {
    throw new Error(
      `MLS ${summary.mode}: ${summary.parseFailures} parse failures (limit ${Math.floor(limit)}) — site markup may have changed. ${JSON.stringify(summary)}`,
    );
  }
  if (summary.guardrailTripped.length > 0) {
    throw new Error(
      `MLS ${summary.mode}: list walk looked wrong for ${summary.guardrailTripped.join(", ")}; departed check skipped. ${JSON.stringify(summary)}`,
    );
  }
  return summary;
}

// ─── Phase 1: backfill ─────────────────────────────────────────────────

/**
 * One-time look back through everything the site will serve (any status,
 * newest first, to the page cap). Resumable: listings already in the table
 * are skipped, and same-day HTML is served from the NAS cache.
 */
export async function backfill(opts: MlsRunOptions): Promise<MlsRunSummary> {
  const adapter = getSiteAdapter(opts.site);
  const fetcher = createFetcher({
    site: adapter.site,
    minDelayMs: adapter.minDelayMs,
    refetch: opts.refetch,
  });
  const summary = emptySummary("backfill", adapter.site);
  const runDate = hstToday();
  const known = await getKnownNumbers(adapter.board);
  let details = 0;

  try {
    for (const island of opts.islands ?? adapter.islands) {
      const walk = await walkList(
        adapter,
        fetcher,
        island,
        "any",
        runDate,
        summary,
        opts.maxPages,
      );
      summary.listed += walk.rows.size;
      log.info(
        {
          island,
          listings: walk.rows.size,
          totalCount: walk.totalCount,
          complete: walk.complete,
        },
        "Backfill list walk done",
      );
      for (const mlsNumber of walk.rows.keys()) {
        if (known.has(mlsNumber)) continue;
        if (opts.maxDetails !== undefined && details >= opts.maxDetails) break;
        details++;
        const result = await fetchAndLoad(
          adapter,
          fetcher,
          mlsNumber,
          runDate,
          summary,
          !!opts.dryRun,
        );
        if (result !== "failed" && result !== "gone") known.add(mlsNumber);
        if (details % 100 === 0)
          log.info({ island, details }, "Backfill detail progress");
      }
    }
  } catch (err) {
    if (!(err instanceof MlsFetchAbort)) throw err;
    log.error(
      { err },
      "Backfill aborted by fetch circuit breaker — rerun to resume",
    );
    finish(summary, fetcher);
    throw err;
  }
  return finish(summary, fetcher);
}

// ─── Phase 2: daily ────────────────────────────────────────────────────

/**
 * Daily pass over the listings that are still open on the site.
 *
 *  1. Walk the open-status list pages.
 *  2. New numbers → fetch + insert.
 *  3. Known numbers → bump last_seen_at; re-fetch only when the list row's
 *     price or status disagrees with the table (or the detail page is stale).
 *  4. Departed — open in our table, absent from today's walk → re-fetch by
 *     number. This is how a sale gets recorded: a sold listing simply stops
 *     appearing in the open list, and its detail page now says Sold. A
 *     listing the site no longer serves at all is marked off_market.
 */
export async function daily(opts: MlsRunOptions): Promise<MlsRunSummary> {
  const adapter = getSiteAdapter(opts.site);
  const fetcher = createFetcher({
    site: adapter.site,
    minDelayMs: adapter.minDelayMs,
    refetch: opts.refetch,
  });
  const summary = emptySummary("daily", adapter.site);
  const runDate = hstToday();
  const dryRun = !!opts.dryRun;
  const islands = opts.islands ?? adapter.islands;

  const open = await getOpenListings(adapter.site);
  const openByNumber = new Map(open.map((k) => [k.mlsNumber, k]));
  const known = await getKnownNumbers(adapter.board);

  const todays = new Set<string>();
  const toFetch: string[] = [];
  const stale: KnownListing[] = [];
  const touched: string[] = [];
  const trustedIslands = new Set<IslandKey>();

  for (const island of islands) {
    const walk = await walkList(
      adapter,
      fetcher,
      island,
      "active",
      runDate,
      summary,
      opts.maxPages,
    );
    summary.listed += walk.rows.size;
    const heldOpen = open.filter(
      (k) => k.island?.toLowerCase() === island,
    ).length;
    const plausible = walk.rows.size >= heldOpen * GUARDRAIL_MIN_RATIO;
    if (walk.complete && plausible && opts.maxPages === undefined) {
      trustedIslands.add(island);
    } else if (opts.maxPages === undefined) {
      summary.guardrailTripped.push(island);
      log.error(
        { island, listed: walk.rows.size, heldOpen, complete: walk.complete },
        "List walk incomplete or implausibly small — skipping departed check for this island",
      );
    }

    for (const row of walk.rows.values()) {
      todays.add(row.mlsNumber);
      const held = openByNumber.get(row.mlsNumber);
      if (!held) {
        // Brand new, or known but closed in our table (back on market).
        toFetch.push(row.mlsNumber);
      } else if (
        held.status !== row.status ||
        (row.listPrice !== null && held.listPrice !== row.listPrice)
      ) {
        toFetch.push(row.mlsNumber);
      } else {
        touched.push(row.mlsNumber);
        if ((held.daysSinceFetch ?? Infinity) >= REFRESH_AFTER_DAYS)
          stale.push(held);
      }
    }
  }

  stale.sort(
    (a, b) => (b.daysSinceFetch ?? Infinity) - (a.daysSinceFetch ?? Infinity),
  );
  for (const k of stale.slice(0, MAX_REFRESH_PER_RUN))
    toFetch.push(k.mlsNumber);

  const departed = open.filter((k) => {
    if (todays.has(k.mlsNumber)) return false;
    const island = k.island?.toLowerCase() as IslandKey | undefined;
    return island !== undefined && trustedIslands.has(island);
  });
  log.info(
    {
      listed: summary.listed,
      new: toFetch.filter((n) => !known.has(n)).length,
      toFetch: toFetch.length,
      departed: departed.length,
    },
    "Daily plan",
  );

  try {
    let details = 0;
    const budget = () =>
      opts.maxDetails === undefined || details < opts.maxDetails;

    for (const mlsNumber of toFetch) {
      if (!budget()) break;
      details++;
      await fetchAndLoad(adapter, fetcher, mlsNumber, runDate, summary, dryRun);
    }

    if (!dryRun) summary.touched = await touchSeen(adapter.board, touched);

    for (const k of departed) {
      if (!budget()) break;
      details++;
      summary.departedChecked++;
      const result = await fetchAndLoad(
        adapter,
        fetcher,
        k.mlsNumber,
        runDate,
        summary,
        dryRun,
      );
      if (result === "gone" && !dryRun) {
        if (await markOffMarket(k.mlsBoard, k.mlsNumber, adapter.site))
          summary.offMarket++;
      }
    }
  } catch (err) {
    if (!(err instanceof MlsFetchAbort)) throw err;
    log.error({ err }, "Daily run aborted by fetch circuit breaker");
    finish(summary, fetcher);
    throw err;
  }
  return finish(summary, fetcher);
}

// ─── Reparse ───────────────────────────────────────────────────────────

/**
 * Re-run the parser over the latest cached snapshot of every listing and
 * upsert the result. No network. This is what makes a parser fix or a newly
 * promoted column cheap.
 */
export async function reparse(opts: MlsRunOptions): Promise<MlsRunSummary> {
  const adapter = getSiteAdapter(opts.site);
  const summary = emptySummary("reparse", adapter.site);
  let n = 0;

  for await (const { mlsNumber, path } of iterateCachedDetails(adapter.site)) {
    if (opts.maxDetails !== undefined && n >= opts.maxDetails) break;
    n++;
    const html = await readHtml(path);
    if (html === null) continue;
    let listing;
    try {
      listing = adapter.parseDetail(html);
    } catch (err) {
      summary.parseFailures++;
      log.error({ mlsNumber, path, err }, "Cached detail page failed to parse");
      continue;
    }
    if (listing === null || opts.dryRun) continue;
    const outcome = await loadListing(
      listing,
      {
        site: adapter.site,
        priority: adapter.priority,
        sourceUrl: adapter.detailUrl(mlsNumber),
        htmlPath: path,
      },
      { reparse: true },
    );
    countOutcome(summary, outcome);
    if (n % 500 === 0) log.info({ n }, "Reparse progress");
  }
  return finish(summary, null);
}
