import { createLogger } from "@/core/observability/logger";

const log = createLogger("mls-db");

/**
 * Waits between attempts when the housing DB is unreachable. ~1h40m in all:
 * long enough to sit out the nightly backup, which takes the DB offline for
 * minutes. rawQuery's own retry is immediate and single — no help against
 * that — and a backfill runs for many hours, so it WILL overlap a backup
 * (the first hres backfill died at 02:14 HST on 2026-09-20, 4,200 listings in).
 */
export const DB_RETRY_WAITS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  45 * 60_000,
];

export function isDbConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  const code = String((err as { code?: unknown }).code ?? "").toLowerCase();
  return [
    "connection closed",
    "connection lost",
    "connection refused",
    "connection timeout",
    "econnreset",
    "econnrefused",
    "epipe",
    "etimedout",
    "server has gone away",
  ].some((s) => msg.includes(s) || code.includes(s));
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wrap a DB call so a lost connection pauses the run instead of killing it.
 * Anything that is not a connection error is rethrown at once. Safe for the
 * loader's calls: each is a read, or an upsert keyed on (board, number).
 */
export function resilient<A extends unknown[], R>(
  label: string,
  fn: (...args: A) => Promise<R>,
  sleepImpl: (ms: number) => Promise<void> = defaultSleep,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn(...args);
      } catch (err) {
        if (!isDbConnectionError(err) || attempt >= DB_RETRY_WAITS_MS.length) {
          throw err;
        }
        const waitMs = DB_RETRY_WAITS_MS[attempt];
        log.warn(
          {
            call: label,
            attempt: attempt + 1,
            waitMs,
            err: (err as Error).message,
          },
          "Housing DB unreachable — pausing the MLS run, will retry",
        );
        await sleepImpl(waitMs);
      }
    }
  };
}
