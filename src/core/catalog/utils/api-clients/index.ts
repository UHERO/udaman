/**
 * Shared types and helpers for government statistics API clients.
 *
 * Each API client module exports a fetchSeries function that returns
 * an ApiResult — a date→value map plus the URL used for audit/description.
 */

export interface ApiResult {
  data: Map<string, number>;
  url: string;
}

// ─── HTTP helpers ────────────────────────────────────────────────────

/** Fetch JSON from a URL with timeout and error handling. */
export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} (${url})`);
  }
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Empty response from ${url}`);
  }
  return JSON.parse(text) as T;
}

/** Fetch XML from a URL, return text content for parsing. */
export async function fetchXml(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} (${url})`);
  }
  return response.text();
}

// ─── Shared throttle + rate-limit retry ──────────────────────────────

/** Default pre-request sleep used by public API clients. */
export const API_DEFAULT_SLEEP_MS = 100;
/** Pause length when a rate-limit error is observed. */
export const API_RATE_LIMIT_PAUSE_MS = 60_000;
/** Max attempts (initial + retries) for a rate-limited request. */
export const API_MAX_ATTEMPTS = 3;

/** Promise-based sleep. */
export const apiSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/**
 * Heuristic detector for rate-limit / too-many-requests errors across the
 * various public APIs we talk to. Matches HTTP 429, the literal phrase
 * "too many requests", "rate limit", and common quota wording.
 */
export function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|too many requests|rate limit|quota/i.test(msg);
}

/**
 * Wraps an API fetch function with a pre-request sleep and a retry-after-
 * pause loop for rate-limit errors. Used by the stateless API clients
 * (BEA, FRED, EIA, DVW, e-Stat). BLS has its own throttle + key rotation
 * and does not go through here.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  opts: {
    sleepMs?: number;
    pauseMs?: number;
    maxAttempts?: number;
  } = {},
): Promise<T> {
  const sleepMs = opts.sleepMs ?? API_DEFAULT_SLEEP_MS;
  const pauseMs = opts.pauseMs ?? API_RATE_LIMIT_PAUSE_MS;
  const maxAttempts = opts.maxAttempts ?? API_MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await apiSleep(sleepMs);
    try {
      return await fn();
    } catch (e) {
      if (isRateLimitError(e) && attempt < maxAttempts) {
        await apiSleep(pauseMs);
        continue;
      }
      throw e;
    }
  }
  // Unreachable: the loop either returns or throws.
  throw new Error("withRateLimitRetry: exhausted without returning");
}

// ─── Date helpers ────────────────────────────────────────────────────

const QUARTER_FIRST_MONTH: Record<string, string> = {
  "1": "01",
  "2": "04",
  "3": "07",
  "4": "10",
};

/**
 * Parse a wide variety of date formats into a yyyy-mm-dd string.
 * Ports the Rails HelperUtilities.grok_date method.
 *
 * Single param: "2024-01-01", "2024-01", "202401", "2024", "2024Q2"
 * Two params: year + period string ("2024", "M01") for BLS/BEA style
 */
export function grokDate(param: string, otherStr?: string): string {
  if (otherStr !== undefined) {
    const year = parseInt(param, 10);
    if (isNaN(year)) {
      throw new Error(`grokDate: expected 4-digit year, got '${param}'`);
    }

    const s = otherStr.trim();

    // M01-M12 → month
    const monthMatch = s.match(/^M?(0[1-9]|1[0-2])\b/);
    if (monthMatch) {
      return `${year}-${monthMatch[1]}-01`;
    }
    // M13 or S01 → annual/semi start
    if (/^(M13|S0?1)\b/.test(s)) return `${year}-01-01`;
    // S02 → July
    if (/^S0?2\b/.test(s)) return `${year}-07-01`;
    // Q1-Q4
    const qMatch = s.match(/^Q0?([1-4])\b/i);
    if (qMatch) {
      return `${year}-${QUARTER_FIRST_MONTH[qMatch[1]]}-01`;
    }
    // Empty other string → annual
    if (s === "") return `${year}-01-01`;

    throw new Error(`grokDate: ungrokkable period string: '${otherStr}'`);
  }

  const str = param.trim();

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // yyyy-mm
  if (/^\d{4}-\d{2}$/.test(str)) return `${str}-01`;

  // yyyymm
  if (/^\d{6}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-01`;
  }

  // yyyy (4-digit year)
  if (/^\d{4}$/.test(str)) return `${str}-01-01`;

  // Quarter: 2024Q2, 2024-Q2, etc.
  const qMatch = str.match(/(\d{4})[-./\s]?Q0?([1-4])/i);
  if (qMatch) {
    return `${qMatch[1]}-${QUARTER_FIRST_MONTH[qMatch[2]]}-01`;
  }

  throw new Error(`grokDate: ungrokkable date format: '${str}'`);
}

/** BEA suppression value — marks non-existent data points */
export const BEA_SUPPRESSED_VALUE = 1.0e15;
