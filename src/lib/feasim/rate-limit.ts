/**
 * Per-key rate limit for the feasim API: each API application may make
 * FEASIM_RATE_LIMIT_PER_MINUTE model requests per minute (default 600, about
 * 10 a second; 0 turns it off). Over the limit, authenticate() answers 429
 * with Retry-After.
 *
 * A key usually belongs to a whole website, so the limit has to cover all of
 * its visitors (a calculator page sends a request per slider move); it is
 * there to stop runaway loops and abuse, not normal use.
 *
 * Counts are kept in memory, per fixed one-minute window. That is exact while
 * udaman runs one web process, as it does today; counts reset on restart. If
 * it ever runs several, each would count separately, and this should move to
 * Redis.
 */

const DEFAULT_PER_MINUTE = 600;
const WINDOW_MS = 60_000;

let override: number | undefined;
const windows = new Map<number, { start: number; count: number }>();

/** Override the limit (tests, scripts); 0 = off. Nothing restores the env. */
export function setRateLimit(perMinute?: number) {
  override = perMinute;
  windows.clear();
}

/** Requests per minute per application; read per call, like the env. */
function limit(): number {
  if (override !== undefined) return override;
  const raw = process.env.FEASIM_RATE_LIMIT_PER_MINUTE;
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_PER_MINUTE;
}

export type RateLimitResult = {
  ok: boolean;
  /** response headers telling the caller where they stand */
  headers: Record<string, string>;
};

/** Count one request for an application, and say whether it's allowed. */
export function checkRateLimit(
  appId: number,
  now = Date.now(),
): RateLimitResult {
  const max = limit();
  if (max === 0) return { ok: true, headers: {} };

  let w = windows.get(appId);
  if (!w || now - w.start >= WINDOW_MS) {
    w = { start: now, count: 0 };
    windows.set(appId, w);
    // forget other applications' finished windows now and then
    if (windows.size > 1000)
      for (const [id, x] of windows)
        if (now - x.start >= WINDOW_MS) windows.delete(id);
  }
  w.count++;

  const resetSeconds = Math.max(
    1,
    Math.ceil((w.start + WINDOW_MS - now) / 1000),
  );
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(max),
    "X-RateLimit-Remaining": String(Math.max(0, max - w.count)),
    "X-RateLimit-Reset": String(resetSeconds),
  };
  if (w.count <= max) return { ok: true, headers };
  return {
    ok: false,
    headers: { ...headers, "Retry-After": String(resetSeconds) },
  };
}
