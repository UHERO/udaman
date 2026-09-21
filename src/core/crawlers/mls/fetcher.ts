import { createLogger } from "@/core/observability/logger";

import { detailPath, listPagePath, readHtml, writeHtml } from "./nas-cache";
import type { ListQuery } from "./types";

const log = createLogger("mls-fetch");

export const DEFAULT_USER_AGENT =
  "UHERO-research-scraper/1.0 (University of Hawaii Economic Research Organization; uhero.hawaii.edu)";

/** Random extra pause added to minDelayMs before every request: 0..1000 ms. */
const JITTER_MS = 1_000;
/** Pause before retry 1, 2, 3. One initial attempt + these = 4 attempts per URL. */
const BACKOFF_MS = [5_000, 20_000, 60_000] as const;
/** Ceiling on any single retry pause, including a server-sent Retry-After. */
const MAX_RETRY_WAIT_MS = 5 * 60_000;
/** A 200 this small is an error stub, not a listing page (real ones are 18KB+). */
const MIN_BODY_BYTES = 1_000;
/** Consecutive failed URLs before the fetcher refuses to continue. */
const BREAKER_THRESHOLD = 5;
const DEFAULT_TIMEOUT_MS = 30_000;

export type FetchResult =
  | { kind: "ok"; html: string; path: string; fromCache: boolean }
  | { kind: "redirect"; location: string | null }
  /** The site answered with one of `goneStatuses` — the page no longer exists. */
  | { kind: "gone"; status: number };

export interface FetcherOptions {
  /** NAS cache directory name, e.g. "hicentral". */
  site: string;
  /** Minimum pause between network requests, before jitter. */
  minDelayMs: number;
  userAgent?: string;
  /**
   * Where pages are written and looked up. Default: the permanent NAS cache
   * (backfill). The daily run passes a per-day temp dir — it keeps no HTML.
   */
  cacheRoot?: string;
  /** Ignore cached copies and fetch again (still writes through). */
  refetch?: boolean;
  /**
   * Follow same-origin 3xx responses, up to MAX_REDIRECT_HOPS. Each hop is a
   * full request that waits out the politeness delay. Off by default: on
   * hicentral a redirect IS the answer ("past the last page").
   */
  followRedirects?: boolean;
  /** Statuses that mean "this page is gone" rather than a failure, e.g. [404]. */
  goneStatuses?: number[];
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  /** Test seams; default Date.now / Math.random. */
  nowImpl?: () => number;
  randomImpl?: () => number;
  /** Per-request timeout so one hung socket cannot stall the queue. Default 30s. */
  timeoutMs?: number;
}

export interface FetcherStats {
  /** Network requests actually sent, retries included. */
  requests: number;
  cacheHits: number;
  retries: number;
}

export interface Fetcher {
  fetchList(
    url: string,
    q: ListQuery,
    runDate: string,
    /** `refetch` bypasses the cache for this one call (a retry of a page that came back empty). */
    opts?: { refetch?: boolean },
  ): Promise<FetchResult>;
  fetchDetail(
    url: string,
    mlsNumber: string,
    date: string,
  ): Promise<FetchResult>;
  stats(): FetcherStats;
  /** True when pages land in the permanent (NAS) cache rather than a temp dir. */
  readonly persistent: boolean;
}

/** One URL failed for good: retries exhausted, or a status we never retry. */
export class MlsFetchError extends Error {
  readonly url: string;
  /** Last HTTP status seen; null when the last attempt was a network error. */
  readonly status: number | null;
  readonly attempts: number;

  constructor(
    message: string,
    info: {
      url: string;
      status: number | null;
      attempts: number;
      cause?: unknown;
    },
  ) {
    super(
      message,
      info.cause === undefined ? undefined : { cause: info.cause },
    );
    this.name = "MlsFetchError";
    this.url = info.url;
    this.status = info.status;
    this.attempts = info.attempts;
  }
}

/**
 * Circuit breaker: several URLs in a row failed, so the site is down or is
 * blocking us. The pipeline must stop, not skip to the next URL. Once thrown,
 * every later network fetch on the same fetcher throws it again immediately.
 */
export class MlsFetchAbort extends Error {
  readonly consecutiveFailures: number;

  constructor(consecutiveFailures: number, cause?: unknown) {
    super(
      `MLS fetch aborted: ${consecutiveFailures} consecutive URLs failed — site is down or blocking us`,
      cause === undefined ? undefined : { cause },
    );
    this.name = "MlsFetchAbort";
    this.consecutiveFailures = consecutiveFailures;
  }
}

/** Failure of a single attempt that is worth retrying. */
type RetryableFailure = {
  reason: string;
  status: number | null;
  retryAfterMs: number | null;
  cause?: unknown;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Retry-After is either delta-seconds or an HTTP date. */
function parseRetryAfter(value: string | null, now: number): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1_000;
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/** Free the connection without caring what the body was. */
async function discardBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    /* already consumed or closed */
  }
}

const MAX_REDIRECT_HOPS = 3;

/** Absolute URL of a redirect target, or null if it leaves the origin (or is unusable). */
function sameOriginTarget(
  from: string,
  location: string | null,
): string | null {
  if (!location) return null;
  try {
    const base = new URL(from);
    const next = new URL(location, base);
    if (next.origin !== base.origin || next.href === base.href) return null;
    return next.href;
  } catch {
    return null;
  }
}

export function createFetcher(opts: FetcherOptions): Fetcher {
  const {
    site,
    minDelayMs,
    userAgent = DEFAULT_USER_AGENT,
    cacheRoot,
    refetch = false,
    followRedirects = false,
    goneStatuses = [],
    fetchImpl = fetch,
    sleepImpl = defaultSleep,
    nowImpl = Date.now,
    randomImpl = Math.random,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;

  if (!Number.isFinite(minDelayMs) || minDelayMs < 0) {
    throw new Error(`mls fetcher: minDelayMs must be >= 0, got ${minDelayMs}`);
  }

  const counters: FetcherStats = { requests: 0, cacheHits: 0, retries: 0 };
  /** When the previous network request finished; null before the first. */
  let lastFinishedAt: number | null = null;
  let consecutiveFailures = 0;
  let tripped = false;

  // Every call — cache lookups included — runs on this chain, so there is at
  // most one request in flight however many callers race, and two callers
  // asking for the same URL produce one request and one cache hit.
  let chain: Promise<unknown> = Promise.resolve();
  function serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(task, task);
    chain = run.catch(() => {});
    return run;
  }

  /** Politeness pause owed before the next request, freshly jittered. */
  function politeWaitMs(): number {
    if (lastFinishedAt === null) return 0;
    const owed = minDelayMs + Math.floor(randomImpl() * (JITTER_MS + 1));
    return Math.max(0, owed - (nowImpl() - lastFinishedAt));
  }

  /** One network attempt. Returns a result, or a failure worth retrying; throws MlsFetchError for the rest. */
  async function attempt(
    url: string,
    cachePath: string,
    attemptNo: number,
  ): Promise<FetchResult | RetryableFailure> {
    counters.requests++;
    let res: Response;
    let html: string | null = null;
    try {
      try {
        res = await fetchImpl(url, {
          redirect: "manual",
          headers: { "User-Agent": userAgent, Accept: "text/html" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        // Body read is inside the same try: a connection dropped mid-body is
        // a network error like any other.
        if (res.status === 200) html = await res.text();
        else await discardBody(res);
      } finally {
        lastFinishedAt = nowImpl();
      }
    } catch (e) {
      return {
        reason: `network error: ${e instanceof Error ? e.message : String(e)}`,
        status: null,
        retryAfterMs: null,
        cause: e,
      };
    }

    if (res.status >= 300 && res.status < 400) {
      // The site's answer to a malformed or past-the-last-page URL. A real
      // response, not an outage: never cached, never retried.
      return { kind: "redirect", location: res.headers.get("location") };
    }

    if (goneStatuses.includes(res.status)) {
      // A real answer from a healthy site: never cached, never retried, and
      // not a strike against the circuit breaker.
      return { kind: "gone", status: res.status };
    }

    if (res.status === 429 || res.status >= 500) {
      return {
        reason: `HTTP ${res.status}`,
        status: res.status,
        retryAfterMs: parseRetryAfter(
          res.headers.get("retry-after"),
          nowImpl(),
        ),
      };
    }

    if (res.status !== 200 || html === null) {
      throw new MlsFetchError(`HTTP ${res.status} for ${url}`, {
        url,
        status: res.status,
        attempts: attemptNo,
      });
    }

    const bytes = Buffer.byteLength(html, "utf8");
    if (bytes < MIN_BODY_BYTES) {
      return {
        reason: `HTTP 200 with a ${bytes}-byte body (< ${MIN_BODY_BYTES})`,
        status: 200,
        retryAfterMs: null,
      };
    }

    await writeHtml(cachePath, html);
    return { kind: "ok", html, path: cachePath, fromCache: false };
  }

  async function fetchWithRetries(
    url: string,
    cachePath: string,
  ): Promise<FetchResult> {
    const maxAttempts = BACKOFF_MS.length + 1;
    let retryWaitMs = 0;
    let last: RetryableFailure | null = null;

    for (let attemptNo = 1; attemptNo <= maxAttempts; attemptNo++) {
      // A retry waits for its backoff; every request waits out the politeness
      // delay. They overlap rather than add.
      const waitMs = Math.max(politeWaitMs(), retryWaitMs);
      if (waitMs > 0) await sleepImpl(waitMs);

      const outcome = await attempt(url, cachePath, attemptNo);
      if ("kind" in outcome) return outcome;

      last = outcome;
      if (attemptNo === maxAttempts) break;

      retryWaitMs = Math.min(
        MAX_RETRY_WAIT_MS,
        Math.max(BACKOFF_MS[attemptNo - 1], outcome.retryAfterMs ?? 0),
      );
      counters.retries++;
      log.warn(
        {
          site,
          url,
          attempt: attemptNo,
          reason: outcome.reason,
          retryInMs: retryWaitMs,
        },
        "mls fetch failed, will retry",
      );
    }

    throw new MlsFetchError(
      `${last?.reason ?? "fetch failed"} for ${url} after ${maxAttempts} attempts`,
      {
        url,
        status: last?.status ?? null,
        attempts: maxAttempts,
        cause: last?.cause,
      },
    );
  }

  async function cacheThrough(
    url: string,
    cachePath: string,
    forceRefetch = false,
  ): Promise<FetchResult> {
    if (!refetch && !forceRefetch) {
      const cached = await readHtml(cachePath);
      // An undersized file cannot have come from writeHtml via this fetcher;
      // treat it as absent rather than serve it forever.
      if (
        cached !== null &&
        Buffer.byteLength(cached, "utf8") >= MIN_BODY_BYTES
      ) {
        counters.cacheHits++;
        return { kind: "ok", html: cached, path: cachePath, fromCache: true };
      }
    }

    if (tripped) throw new MlsFetchAbort(consecutiveFailures);

    try {
      let result = await fetchWithRetries(url, cachePath);
      // Slugged detail URLs drift; the site 301s the old slug to the new one.
      // The page is cached under the key the caller asked for either way.
      let from = url;
      for (
        let hop = 0;
        followRedirects &&
        result.kind === "redirect" &&
        hop < MAX_REDIRECT_HOPS;
        hop++
      ) {
        const next = sameOriginTarget(from, result.location);
        if (next === null) break;
        from = next;
        result = await fetchWithRetries(next, cachePath);
      }
      // A redirect says nothing either way about whether the site is healthy
      // for real pages, so only a served page clears the failure streak.
      if (result.kind === "ok") consecutiveFailures = 0;
      return result;
    } catch (e) {
      if (!(e instanceof MlsFetchError)) throw e; // e.g. cache write failed
      consecutiveFailures++;
      log.error(
        {
          site,
          url,
          status: e.status,
          attempts: e.attempts,
          consecutiveFailures,
        },
        "mls fetch gave up on url",
      );
      if (consecutiveFailures >= BREAKER_THRESHOLD) {
        tripped = true;
        throw new MlsFetchAbort(consecutiveFailures, e);
      }
      throw e;
    }
  }

  return {
    // async so a bad path argument rejects instead of throwing synchronously;
    // the task is still enqueued in call order (nothing awaits before it).
    fetchList: async (url, q, runDate, callOpts) => {
      const cachePath = listPagePath(site, runDate, q, cacheRoot);
      return serialize(() => cacheThrough(url, cachePath, callOpts?.refetch));
    },
    fetchDetail: async (url, mlsNumber, date) => {
      const cachePath = detailPath(site, mlsNumber, date, cacheRoot);
      return serialize(() => cacheThrough(url, cachePath));
    },
    stats: () => ({ ...counters }),
    persistent: cacheRoot === undefined,
  };
}
