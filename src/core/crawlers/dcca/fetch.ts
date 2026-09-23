/**
 * Polite HTTP for the DCCA register: one request at a time, a pause plus
 * jitter before each, exponential backoff on 5xx / 429 / network errors,
 * Retry-After honored, and a circuit breaker so a site outage stops the run
 * instead of burning through 9,000 failing requests.
 */

import { createLogger } from "@/core/observability/logger";

import {
  DCCA_JITTER_MS,
  DCCA_MIN_DELAY_MS,
  DCCA_TIMEOUT_MS,
  DCCA_USER_AGENT,
} from "./config";

const log = createLogger("dcca-fetch");

/** Pause before retry 1, 2, 3 — one initial attempt + these = 4 per URL. */
const BACKOFF_MS = [5_000, 20_000, 60_000] as const;
const MAX_RETRY_WAIT_MS = 5 * 60_000;
const BREAKER_THRESHOLD = 5;

export class DccaFetchError extends Error {
  readonly url: string;
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
    this.name = "DccaFetchError";
    this.url = info.url;
    this.status = info.status;
    this.attempts = info.attempts;
  }
}

/** Several URLs in a row failed for good: the site is down or blocking us. */
export class DccaFetchAbort extends Error {
  constructor(
    readonly consecutiveFailures: number,
    cause?: unknown,
  ) {
    super(
      `DCCA fetch aborted: ${consecutiveFailures} consecutive URLs failed — site is down or blocking us`,
      cause === undefined ? undefined : { cause },
    );
    this.name = "DccaFetchAbort";
  }
}

export interface FetcherOptions {
  minDelayMs?: number;
  jitterMs?: number;
  timeoutMs?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  randomImpl?: () => number;
}

export interface FetcherStats {
  requests: number;
  retries: number;
}

export interface Fetcher {
  /** Resolve to the body; reject with DccaFetchError / DccaFetchAbort. */
  get(url: string, minBytes: number): Promise<string>;
  stats(): FetcherStats;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

export function createFetcher(opts: FetcherOptions = {}): Fetcher {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleepImpl ?? defaultSleep;
  const random = opts.randomImpl ?? Math.random;
  const minDelay = opts.minDelayMs ?? DCCA_MIN_DELAY_MS;
  const jitter = opts.jitterMs ?? DCCA_JITTER_MS;
  const timeoutMs = opts.timeoutMs ?? DCCA_TIMEOUT_MS;
  const userAgent = opts.userAgent ?? DCCA_USER_AGENT;

  const stats: FetcherStats = { requests: 0, retries: 0 };
  let consecutiveFailures = 0;
  let aborted: DccaFetchAbort | null = null;

  async function attempt(
    url: string,
    minBytes: number,
  ): Promise<
    | { ok: true; body: string }
    | {
        ok: false;
        status: number | null;
        retry: boolean;
        wait: number | null;
        reason: string;
        cause?: unknown;
      }
  > {
    stats.requests++;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        headers: { "user-agent": userAgent, accept: "text/html" },
        redirect: "follow",
        signal: ctl.signal,
      });
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) {
        return {
          ok: false,
          status: res.status,
          retry: true,
          wait: retryAfterMs(res.headers.get("retry-after")),
          reason: `HTTP ${res.status}`,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          retry: false,
          wait: null,
          reason: `HTTP ${res.status}`,
        };
      }
      if (body.length < minBytes) {
        return {
          ok: false,
          status: res.status,
          retry: true,
          wait: null,
          reason: `body ${body.length} B < ${minBytes} B`,
        };
      }
      return { ok: true, body };
    } catch (err) {
      return {
        ok: false,
        status: null,
        retry: true,
        wait: null,
        reason: (err as Error).message,
        cause: err,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async get(url, minBytes) {
      if (aborted) throw aborted;
      let last: { status: number | null; reason: string; cause?: unknown } = {
        status: null,
        reason: "",
      };
      let attempts = 0;
      for (let i = 0; ; i++) {
        await sleep(minDelay + Math.floor(random() * jitter));
        attempts++;
        const r = await attempt(url, minBytes);
        if (r.ok) {
          consecutiveFailures = 0;
          return r.body;
        }
        last = r;
        const canRetry = r.retry && i < BACKOFF_MS.length;
        if (!canRetry) break;
        stats.retries++;
        const wait = Math.min(r.wait ?? BACKOFF_MS[i], MAX_RETRY_WAIT_MS);
        log.warn(
          { url, attempt: i + 1, waitMs: wait, reason: r.reason },
          "DCCA request failed, retrying",
        );
        await sleep(wait);
      }
      consecutiveFailures++;
      const err = new DccaFetchError(`${url}: ${last.reason}`, {
        url,
        status: last.status,
        attempts,
        cause: last.cause,
      });
      if (consecutiveFailures >= BREAKER_THRESHOLD) {
        aborted = new DccaFetchAbort(consecutiveFailures, err);
        throw aborted;
      }
      throw err;
    },
    stats: () => ({ ...stats }),
  };
}
