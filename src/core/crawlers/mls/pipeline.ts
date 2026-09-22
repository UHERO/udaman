import { existsSync } from "fs";
import nodePath from "path";

import { hstToday } from "@/core/catalog/utils/time";
import { createLogger } from "@/core/observability/logger";

import { resilient } from "./db-retry";
import { createFetcher, MlsFetchAbort } from "./fetcher";
import * as db from "./load";
import { listingKey } from "./load";
import type { ListingOwner, LoadOutcome } from "./load";
import {
  iterateCachedDetails,
  mlsCacheRoot,
  mlsTempRoot,
  pruneTemp,
  readHtml,
} from "./nas-cache";
import { getSiteAdapter } from "./registry";
import type {
  IslandKey,
  ListRow,
  MlsBoard,
  SiteAdapter,
  StatusSet,
} from "./types";
import { walkList } from "./walk";
import type { WalkResult } from "./walk";

const log = createLogger("mls-pipeline");

// Every DB call goes through resilient(): a run lasts hours and must sit out
// the nightly backup rather than die in it.
const applyListChange = resilient("applyListChange", db.applyListChange);
const getKnownListings = resilient("getKnownListings", db.getKnownListings);
const getOpenListings = resilient("getOpenListings", db.getOpenListings);
const loadListing = resilient("loadListing", db.loadListing);
const markOffMarket = resilient("markOffMarket", db.markOffMarket);
const touchSeen = resilient("touchSeen", db.touchSeen);

type Fetcher = ReturnType<typeof createFetcher>;

export interface MlsRunOptions {
  site: string;
  /** Default: every island the adapter lists. */
  islands?: IslandKey[];
  /** Stop each list walk after this many pages (smoke tests). */
  maxPages?: number;
  /** Stop after this many detail fetches+loads (smoke tests). */
  maxDetails?: number;
  /** Backfill: walk only the closed-sales lists (adapter.soldWalkIslands). */
  soldOnly?: boolean;
  /** Fetch, cache and parse as normal but write nothing to the database. */
  dryRun?: boolean;
  /** Ignore same-day cached HTML. */
  refetch?: boolean;
  /**
   * Polled between requests; returning true ends the run early with
   * MlsRunInterrupted (the host process is shutting down).
   */
  shouldStop?: () => boolean;
}

/** The run was asked to stop. Whatever it had loaded stays loaded. */
export class MlsRunInterrupted extends Error {
  constructor() {
    super("MLS run interrupted by shutdown");
    this.name = "MlsRunInterrupted";
  }
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
  /** Status / list-price changes recorded straight from list rows (no page fetch). */
  listChanges: number;
  /** Listed here but maintained by a higher-priority site: seen, not fetched. */
  deferredToOtherSite: number;
  departedChecked: number;
  offMarket: number;
  parseFailures: number;
  requests: number;
  cacheHits: number;
  /** Islands whose departed check was skipped because the walk looked wrong. */
  guardrailTripped: IslandKey[];
  /** Per island: listings read vs the site's own count, e.g. "oahu 9980/20610 (page cap)". */
  walks: string[];
  /** List pages that stayed bad through every retry, e.g. "oahu: p28, p29". Rerun to fill them in. */
  incompleteWalks: string[];
}

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
    listChanges: 0,
    deferredToOtherSite: 0,
    departedChecked: 0,
    offMarket: 0,
    parseFailures: 0,
    requests: 0,
    cacheHits: 0,
    guardrailTripped: [],
    walks: [],
    incompleteWalks: [],
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

/**
 * `cacheRoot` undefined = the permanent NAS cache (backfill); the daily run
 * passes its per-day temp dir.
 */
export function makeFetcher(
  adapter: SiteAdapter,
  refetch?: boolean,
  cacheRoot?: string,
): Fetcher {
  return createFetcher({
    site: adapter.site,
    cacheRoot,
    minDelayMs: adapter.minDelayMs,
    followRedirects: adapter.followRedirects,
    goneStatuses: adapter.goneStatuses,
    refetch,
  });
}

function recordWalk(
  summary: MlsRunSummary,
  island: string,
  walk: WalkResult,
): void {
  summary.walks.push(
    `${island} ${walk.rows.size}/${walk.totalCount ?? "?"}${walk.capped ? " (page cap)" : ""}`,
  );
  if (walk.skippedPages.length === 0 && !walk.aborted) return;
  const pages = walk.skippedPages.map((p) => `p${p}`).join(", ");
  summary.incompleteWalks.push(
    `${island}: ${pages}${walk.aborted ? " — walk aborted" : ""}`,
  );
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
    // Only a page in the permanent cache is worth pointing at; the daily run's
    // temp copy is gone tomorrow.
    htmlPath: fetcher.persistent ? res.path : null,
  });
  countOutcome(summary, outcome);
  if (outcome !== "skipped_lower_priority") {
    known?.set(listingKey(listing.mlsBoard, listing.mlsNumber), {
      site: adapter.site,
      priority: adapter.priority,
      status: listing.status,
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
  if (summary.incompleteWalks.length > 0) {
    throw new Error(
      `MLS ${summary.mode}: list pages could not be read (${summary.incompleteWalks.join("; ")}). Everything that was listed has been loaded — rerun to pick up the rest. ${JSON.stringify(summary)}`,
    );
  }
  if (summary.guardrailTripped.length > 0) {
    throw new Error(
      `MLS ${summary.mode}: list walk looked wrong for ${summary.guardrailTripped.join(", ")}; departed check skipped. ${JSON.stringify(summary)}`,
    );
  }
  return summary;
}

/**
 * Backfill exists to build the permanent HTML corpus, so it must not quietly
 * write somewhere else. Without this, a host with no NAS would mkdir -p the
 * mount path on its own disk (or fail one page at a time).
 */
export function assertPermanentCacheAvailable(): void {
  if (process.env.MLS_NAS_PATH?.trim()) return; // explicit override (dev)
  const scrapesRoot = nodePath.dirname(mlsCacheRoot());
  if (!existsSync(scrapesRoot)) {
    throw new Error(
      `MLS backfill saves its HTML to the NAS, but ${scrapesRoot} is not there — mount the NAS, or set MLS_NAS_PATH to save elsewhere.`,
    );
  }
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
  assertPermanentCacheAvailable();
  const fetcher = makeFetcher(adapter, opts.refetch);
  const summary = emptySummary("backfill", adapter.site);
  const runDate = hstToday();
  const known = await getKnownListings(adapter.boards);
  let details = 0;

  // Each island's main list, then its separate closed-sales list if the site
  // has one. --sold-only skips the main lists (they were walked already).
  const walks: { island: IslandKey; statusSet: StatusSet }[] = [];
  for (const island of opts.islands ?? adapter.islands) {
    if (!opts.soldOnly) walks.push({ island, statusSet: "any" });
    if (adapter.soldWalkIslands?.includes(island)) {
      walks.push({ island, statusSet: "sold" });
    }
  }
  if (walks.length === 0) {
    throw new Error(
      `MLS backfill: nothing to walk — ${adapter.site} has no sold list for ${(opts.islands ?? adapter.islands).join(", ")}`,
    );
  }

  try {
    for (const { island, statusSet } of walks) {
      const walk = await walkList(
        adapter,
        fetcher,
        island,
        statusSet,
        runDate,
        summary,
        { maxPages: opts.maxPages },
      );
      const label = statusSet === "sold" ? `${island} (sold)` : island;
      recordWalk(summary, label, walk);
      summary.listed += walk.rows.size;
      log.info(
        {
          island,
          statusSet,
          listings: walk.rows.size,
          totalCount: walk.totalCount,
          capped: walk.capped,
          skippedPages: walk.skippedPages,
        },
        "Backfill list walk done",
      );
      for (const row of walk.rows.values()) {
        const { owner } = findOwner(known, adapter, row);
        if (owner && !shouldRefetch(owner, adapter, statusSet)) {
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
          log.info({ island, statusSet, details }, "Backfill detail progress");
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

/**
 * Whether backfill should fetch a listing that is already in the table.
 * Normally no — that is what makes a rerun cheap. Two exceptions: a lower-
 * priority site holds it (take it over), or it turned up in a closed-sales
 * list while our own row still says otherwise (open, or off_market because it
 * vanished from the open list) — one fetch records the sale.
 */
export function shouldRefetch(
  owner: ListingOwner,
  adapter: SiteAdapter,
  statusSet: StatusSet,
): boolean {
  if (owner.priority < adapter.priority) return true;
  return (
    statusSet === "sold" &&
    owner.site === adapter.site &&
    owner.status !== "sold"
  );
}

// ─── Phase 2: daily ────────────────────────────────────────────────────

/**
 * Daily pass over the listings that are still open on the site. Its job is
 * to catch every listing at least once — some are only up for days — while
 * fetching as little as possible: what we keep the detail page for is the
 * property's characteristics, and those don't change once we have them.
 *
 *  1. Walk the open-status list pages (cheap: 20–48 listings per request).
 *  2. New numbers → fetch the detail page once, insert.
 *  3. Already on file → no fetch. Bump last_seen_at; a status or list-price
 *     change visible on the list row is recorded from the row itself.
 *  4. Departed — open in our table, absent from today's walk. A site that
 *     keeps serving sold listings (hicentral) gets one final fetch, which is
 *     where the sold price and date come from; otherwise the listing is
 *     simply marked off_market.
 *
 * So a listing costs one detail request when it appears and, on hicentral,
 * one more when it leaves.
 */
export async function daily(opts: MlsRunOptions): Promise<MlsRunSummary> {
  const adapter = getSiteAdapter(opts.site);
  const fetcher = makeFetcher(adapter, opts.refetch, mlsTempRoot(hstToday()));
  const summary = emptySummary("daily", adapter.site);
  const runDate = hstToday();
  const dryRun = !!opts.dryRun;
  const islands = opts.islands ?? adapter.islands;
  const checkStop = () => {
    if (opts.shouldStop?.()) throw new MlsRunInterrupted();
  };

  await pruneTemp(runDate);

  const open = await getOpenListings(adapter.site);
  const openByKey = new Map(
    open.map((k) => [listingKey(k.mlsBoard, k.mlsNumber), k]),
  );
  const known = await getKnownListings(adapter.boards);

  const todays = new Set<string>();
  const toFetch = new Map<string, string | undefined>();
  const changed: { key: string; row: ListRow }[] = [];
  const touched = new Map<MlsBoard, string[]>();
  const trustedIslands = new Set<IslandKey>();
  let brandNew = 0;

  const split = (key: string) => key.split(":") as [MlsBoard, string];
  const touch = (key: string) => {
    const [board, number] = split(key);
    touched.set(board, [...(touched.get(board) ?? []), number]);
  };

  for (const island of islands) {
    checkStop();
    const walk = await walkList(
      adapter,
      fetcher,
      island,
      "active",
      runDate,
      summary,
      { maxPages: opts.maxPages, shouldStop: opts.shouldStop },
    );
    if (walk.interrupted) throw new MlsRunInterrupted();
    recordWalk(summary, island, walk);
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
        if (!held) {
          // Closed in our table and listed again: back on the market.
          toFetch.set(row.mlsNumber, row.detailUrl);
          continue;
        }
        const statusChanged =
          row.status !== "unknown" && held.status !== row.status;
        const priceChanged =
          row.listPrice !== null && held.listPrice !== row.listPrice;
        if (statusChanged || priceChanged) changed.push({ key, row });
        else touch(key);
      }
    }
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
      listChanges: changed.length,
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
      checkStop();
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
      for (const { key, row } of changed) {
        const [board, number] = split(key);
        const applied = await applyListChange(board, number, adapter.site, {
          status: row.status,
          listPrice: row.listPrice,
        });
        if (applied) summary.listChanges++;
      }
    }

    for (const k of departed) {
      checkStop();
      summary.departedChecked++;
      if (!adapter.reportsSold) {
        if (
          !dryRun &&
          (await markOffMarket(k.mlsBoard, k.mlsNumber, adapter.site))
        ) {
          summary.offMarket++;
        }
        continue;
      }
      if (!budget()) break;
      details++;
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
