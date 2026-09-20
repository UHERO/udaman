import { hstToday } from "@/core/catalog/utils/time";
import { createLogger } from "@/core/observability/logger";

import { createFetcher, MlsFetchAbort } from "./fetcher";
import {
  getKnownListings,
  getOpenListings,
  listingKey,
  loadListing,
  markOffMarket,
  touchSeen,
} from "./load";
import type { KnownListing, ListingOwner, LoadOutcome } from "./load";
import { iterateCachedDetails, readHtml } from "./nas-cache";
import { getSiteAdapter } from "./registry";
import type {
  IslandKey,
  ListRow,
  MlsBoard,
  SiteAdapter,
  StatusSet,
} from "./types";

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
  /** Listed here but maintained by a higher-priority site: seen, not fetched. */
  deferredToOtherSite: number;
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
    deferredToOtherSite: 0,
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

type Known = Map<string, ListingOwner>;

/**
 * Find a list row in the table. A row that does not reveal its board is
 * tried against every board the site carries.
 */
function findOwner(
  known: Known,
  adapter: SiteAdapter,
  row: ListRow,
): { key: string | null; owner: ListingOwner | null } {
  for (const board of row.mlsBoard ? [row.mlsBoard] : adapter.boards) {
    const key = listingKey(board, row.mlsNumber);
    const owner = known.get(key);
    if (owner) return { key, owner };
  }
  return {
    key: row.mlsBoard ? listingKey(row.mlsBoard, row.mlsNumber) : null,
    owner: null,
  };
}

/** Which of the adapter's list walks would contain a listing stored with this island. */
function walkFor(
  adapter: SiteAdapter,
  island: string | null,
): IslandKey | null {
  if (adapter.walkFor) return adapter.walkFor(island);
  const key = island?.toLowerCase() as IslandKey | undefined;
  return key && adapter.islands.includes(key) ? key : null;
}

function makeFetcher(adapter: SiteAdapter, refetch?: boolean): Fetcher {
  return createFetcher({
    site: adapter.site,
    minDelayMs: adapter.minDelayMs,
    followRedirects: adapter.followRedirects,
    goneStatuses: adapter.goneStatuses,
    refetch,
  });
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
    // hicentral redirects to an error page past its last page; a site that
    // 404s there says the same thing.
    if (res.kind !== "ok") return { rows, totalCount, complete: true };
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
  /** The list row's own link when it has one; else built from the number. */
  fetchUrl: string | undefined,
  runDate: string,
  summary: MlsRunSummary,
  dryRun: boolean,
  known?: Known,
): Promise<DetailResult> {
  // Stored as source_url: the form that can be rebuilt from the number, since
  // slugged links drift.
  const url = adapter.detailUrl(mlsNumber);
  const res = await fetcher.fetchDetail(fetchUrl ?? url, mlsNumber, runDate);
  if (res.kind === "gone") return "gone";
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
  if (outcome !== "skipped_lower_priority") {
    known?.set(listingKey(listing.mlsBoard, listing.mlsNumber), {
      site: adapter.site,
      priority: adapter.priority,
    });
  }
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
 * are skipped, and same-day HTML is served from the NAS cache. A listing a
 * higher-priority site already maintains is never fetched.
 */
export async function backfill(opts: MlsRunOptions): Promise<MlsRunSummary> {
  const adapter = getSiteAdapter(opts.site);
  const fetcher = makeFetcher(adapter, opts.refetch);
  const summary = emptySummary("backfill", adapter.site);
  const runDate = hstToday();
  const known = await getKnownListings(adapter.boards);
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
      for (const row of walk.rows.values()) {
        const { owner } = findOwner(known, adapter, row);
        if (owner && owner.priority >= adapter.priority) {
          if (owner.site !== adapter.site) summary.deferredToOtherSite++;
          continue;
        }
        if (opts.maxDetails !== undefined && details >= opts.maxDetails) break;
        details++;
        await fetchAndLoad(
          adapter,
          fetcher,
          row.mlsNumber,
          row.detailUrl,
          runDate,
          summary,
          !!opts.dryRun,
          known,
        );
        if (details % 100 === 0) {
          log.info({ island, details }, "Backfill detail progress");
        }
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
 *     A listing maintained by a higher-priority site is only ever touched.
 *  4. Departed — open in our table, absent from today's walk → re-fetch by
 *     number. This is how a sale gets recorded: a sold listing simply stops
 *     appearing in the open list, and its detail page now says Sold. A
 *     listing the site no longer serves at all is marked off_market.
 */
export async function daily(opts: MlsRunOptions): Promise<MlsRunSummary> {
  const adapter = getSiteAdapter(opts.site);
  const fetcher = makeFetcher(adapter, opts.refetch);
  const summary = emptySummary("daily", adapter.site);
  const runDate = hstToday();
  const dryRun = !!opts.dryRun;
  const islands = opts.islands ?? adapter.islands;

  const open = await getOpenListings(adapter.site);
  const openByKey = new Map(
    open.map((k) => [listingKey(k.mlsBoard, k.mlsNumber), k]),
  );
  const known = await getKnownListings(adapter.boards);

  const todays = new Set<string>();
  const toFetch = new Map<string, string | undefined>();
  const stale: KnownListing[] = [];
  const touched = new Map<MlsBoard, string[]>();
  const trustedIslands = new Set<IslandKey>();
  let brandNew = 0;

  const touch = (key: string) => {
    const [board, number] = key.split(":") as [MlsBoard, string];
    touched.set(board, [...(touched.get(board) ?? []), number]);
  };

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
      (k) => walkFor(adapter, k.island) === island,
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
      const { key, owner } = findOwner(known, adapter, row);
      if (key) todays.add(key);

      if (!owner || !key) {
        brandNew++;
        toFetch.set(row.mlsNumber, row.detailUrl);
      } else if (owner.priority > adapter.priority) {
        // A better source maintains this row; we only vouch that it is
        // still listed.
        summary.deferredToOtherSite++;
        touch(key);
      } else if (owner.site !== adapter.site) {
        // Held by a lower-priority site: take it over.
        toFetch.set(row.mlsNumber, row.detailUrl);
      } else {
        const held = openByKey.get(key);
        const statusChanged =
          row.status !== "unknown" && held?.status !== row.status;
        const priceChanged =
          row.listPrice !== null && held?.listPrice !== row.listPrice;
        if (!held || statusChanged || priceChanged) {
          // Changed — or closed in our table and back on the market.
          toFetch.set(row.mlsNumber, row.detailUrl);
        } else {
          touch(key);
          if ((held.daysSinceFetch ?? Infinity) >= REFRESH_AFTER_DAYS) {
            stale.push(held);
          }
        }
      }
    }
  }

  stale.sort(
    (a, b) => (b.daysSinceFetch ?? Infinity) - (a.daysSinceFetch ?? Infinity),
  );
  for (const k of stale.slice(0, MAX_REFRESH_PER_RUN)) {
    if (!toFetch.has(k.mlsNumber)) toFetch.set(k.mlsNumber, undefined);
  }

  const departed = open.filter((k) => {
    if (todays.has(listingKey(k.mlsBoard, k.mlsNumber))) return false;
    const walk = walkFor(adapter, k.island);
    return walk !== null && trustedIslands.has(walk);
  });
  log.info(
    {
      listed: summary.listed,
      new: brandNew,
      toFetch: toFetch.size,
      deferred: summary.deferredToOtherSite,
      departed: departed.length,
    },
    "Daily plan",
  );

  try {
    let details = 0;
    const budget = () =>
      opts.maxDetails === undefined || details < opts.maxDetails;

    for (const [mlsNumber, fetchUrl] of toFetch) {
      if (!budget()) break;
      details++;
      await fetchAndLoad(
        adapter,
        fetcher,
        mlsNumber,
        fetchUrl,
        runDate,
        summary,
        dryRun,
      );
    }

    if (!dryRun) {
      for (const [board, numbers] of touched) {
        summary.touched += await touchSeen(board, numbers);
      }
    }

    for (const k of departed) {
      if (!budget()) break;
      details++;
      summary.departedChecked++;
      const result = await fetchAndLoad(
        adapter,
        fetcher,
        k.mlsNumber,
        undefined,
        runDate,
        summary,
        dryRun,
      );
      if (result === "gone" && !dryRun) {
        if (await markOffMarket(k.mlsBoard, k.mlsNumber, adapter.site)) {
          summary.offMarket++;
        }
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
