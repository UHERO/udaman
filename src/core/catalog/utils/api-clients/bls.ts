/**
 * BLS (Bureau of Labor Statistics) API client.
 * https://www.bls.gov/developers/
 *
 * Both fetchSeries and fetchSeriesV2 hit the v2 JSON endpoint. They share a
 * 200ms throttle and use a sticky API key with automatic failover: we stay
 * on the current key until a rate-limit failure, at which point we advance
 * to the next configured key and retry the same request. This maximizes the
 * daily request budget (BLS allows 500/day per registered key) without
 * flipping back to an exhausted key on every other request.
 *
 * Only rate-limit type errors trigger key cycling. Permanent errors such as
 * "Series does not exist" (a series was renamed/discontinued by BLS, or the
 * caller passed a bad ID) are thrown immediately so we don't burn through
 * every key trying to fetch something that will never succeed.
 *
 * BLS limits the API to 50 requests per 10 seconds, so the 200ms throttle
 * is enforced between every outbound request (including retries).
 */

import { createLogger } from "@/core/observability/logger";

import { fetchJson, grokDate, type ApiResult } from "./index";

const log = createLogger("api.bls");

/**
 * Error thrown when BLS signals that the current registration key has
 * exhausted its quota or hit a short-term rate limit. Only this specific
 * error type causes `withKeyRetry` to advance to the next configured key.
 */
class BlsRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlsRateLimitError";
  }
}

/**
 * Patterns in a BLS API error message that indicate a rate limit / quota
 * problem and therefore justify trying a different registration key.
 * Everything else (invalid series, unauthorized, malformed request) is
 * treated as permanent and bubbles up on the first attempt.
 */
const BLS_RATE_LIMIT_PATTERNS: RegExp[] = [
  /daily threshold/i,
  /threshold security/i,
  /threshold for this query/i,
  /request.*exceeded/i,
  /exceeded.*request/i,
  /rate limit/i,
  /too many requests/i,
  /quota/i,
];

function isBlsRateLimitMessage(msg: string): boolean {
  return BLS_RATE_LIMIT_PATTERNS.some((re) => re.test(msg));
}

/**
 * Classify a BLS error message and throw either a `BlsRateLimitError`
 * (retryable — cycle keys) or a plain `Error` (permanent — bubble up).
 */
function throwBlsError(label: string, message: string): never {
  const full = `${label}: ${message}`;
  if (isBlsRateLimitMessage(message)) {
    throw new BlsRateLimitError(full);
  }
  throw new Error(full);
}

// ─── Shared throttle + sticky key with failover ──────────────────────

const BLS_KEY_ENV_VARS = [
  "API_KEY_1_BLS_V2",
  "API_KEY_2_BLS_V2",
  "API_KEY_3_BLS_V2",
  "API_KEY_4_BLS_V2",
] as const;
const BLS_MIN_INTERVAL_MS = 200;
/** Sticky index of the currently-active BLS key. Only advances on failure. */
let blsKeyIndex = 0;
let blsNextRequestAt = 0;

/** Returns the list of configured BLS keys, or throws if none are set. */
function getBlsKeys(): string[] {
  const keys = BLS_KEY_ENV_VARS.map((name) => process.env[name]).filter(
    (k): k is string => Boolean(k),
  );
  if (keys.length === 0) {
    throw new Error(
      `No BLS API keys defined (set ${BLS_KEY_ENV_VARS.join(" and/or ")})`,
    );
  }
  return keys;
}

/** Sleeps until at least BLS_MIN_INTERVAL_MS has elapsed since the previous call. */
async function throttleBls(): Promise<void> {
  const now = Date.now();
  if (now < blsNextRequestAt) {
    await new Promise((r) => setTimeout(r, blsNextRequestAt - now));
  }
  blsNextRequestAt = Date.now() + BLS_MIN_INTERVAL_MS;
}

/**
 * Run `fetchWithKey` against the currently-active BLS key. Only a
 * `BlsRateLimitError` causes us to advance to the next key and retry —
 * everything else (bad series ID, unauthorized, server error) is thrown
 * immediately so we don't waste the entire key pool on a request that will
 * never succeed.
 *
 * The module-level `blsKeyIndex` persists across calls, so once a key has
 * hit its rate limit we stay on the new key for subsequent requests rather
 * than rotating back.
 */
async function withKeyRetry<T>(
  fetchWithKey: (apiKey: string) => Promise<T>,
): Promise<T> {
  const keys = getBlsKeys();
  let lastError: unknown;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[blsKeyIndex % keys.length];
    try {
      await throttleBls();
      return await fetchWithKey(key);
    } catch (err) {
      lastError = err;
      if (!(err instanceof BlsRateLimitError)) {
        // Non-rate-limit error: throw immediately without cycling keys.
        throw err;
      }
      // Rate-limited: advance the sticky index so the next call — and the
      // next retry — skip the exhausted key.
      blsKeyIndex = (blsKeyIndex + 1) % keys.length;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All BLS keys rate-limited");
}

// ─── BLS v2 ─────────────────────────────────────────────────────────

/**
 * Fetch a time series from the BLS v2 JSON API.
 * Defaults to 20 years of data. Automatically chunks into 20-year
 * windows when a wider custom range is requested.
 *
 * @param seriesId - BLS series ID (e.g. "LNS12000000")
 * @param _frequency - Unused; the seriesId encodes frequency. Kept for signature parity.
 * @param startYear - First year to fetch (default: 20 years ago)
 * @param endYear - Last year to fetch (default: current year)
 */
export async function fetchSeries(
  seriesId: string,
  _frequency?: string | null,
  startYear?: number,
  endYear?: number,
): Promise<ApiResult> {
  const end = endYear ?? new Date().getFullYear();
  const start = startYear ?? end - 19;
  const BLS_MAX_SPAN = 20; // BLS v2 allows at most 20 years per request

  const data = new Map<string, number>();
  let lastUrl = "";

  // Chunk into 20-year windows when the requested range exceeds the API limit
  for (let chunkStart = start; chunkStart <= end; chunkStart += BLS_MAX_SPAN) {
    const chunkEnd = Math.min(chunkStart + BLS_MAX_SPAN - 1, end);
    await withKeyRetry(async (apiKey) => {
      const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/${seriesId}?registrationkey=${apiKey}&startyear=${chunkStart}&endyear=${chunkEnd}`;
      lastUrl = url;
      log.info({ url }, "BLS fetch");

      const json = await fetchJson<BlsV1Response>(url);

      if (!/succeeded/i.test(json.status ?? "")) {
        const msg = Array.isArray(json.message)
          ? json.message.join(" ")
          : String(json.message ?? "Unknown error");
        throwBlsError("BLS API error", msg);
      }

      const resultsData = json.Results?.series?.[0]?.data;
      if (!resultsData || resultsData.length === 0) {
        log.info({ url }, "BLS chunk empty (no data for range)");
        return;
      }

      log.info({ url, points: resultsData.length }, "BLS chunk received");
      for (const dp of resultsData) {
        const date = grokDate(dp.year, dp.period);
        const value = parseFloat(String(dp.value).replace(/,/g, ""));
        if (!isNaN(value)) {
          data.set(date, value);
        }
      }
    });
  }

  if (data.size === 0) {
    throw new Error(`BLS API: No data returned for ${seriesId} (${start}–${end})`);
  }

  log.info({ seriesId, start, end, totalPoints: data.size }, "BLS fetch complete");
  return { data, url: lastUrl };
}

/** @deprecated Use fetchSeries — this is kept for backwards compat only. */
export const fetchSeriesV2 = fetchSeries;

// ─── Types ───────────────────────────────────────────────────────────

interface BlsDataPoint {
  year: string;
  period: string;
  value: string;
}

interface BlsV1Response {
  status?: string;
  message?: string | string[];
  Results?: {
    series?: Array<{
      data: BlsDataPoint[];
    }>;
  };
}
