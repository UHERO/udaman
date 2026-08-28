import { createLogger } from "@/core/observability/logger";

import { rawQuery, reserveConnection } from "./db";

const log = createLogger("database.lock");

/**
 * Cross-process advisory lock for DB-heavy work (uploads, reloads, public
 * data sweeps). Backed by MySQL `GET_LOCK`, so it serializes across the
 * web process, the BullMQ worker and any CLI script that talks to the
 * same server — BullMQ concurrency settings can't do that on their own.
 *
 * `GET_LOCK` is session-scoped: the lock is held by one connection and is
 * released automatically when that connection closes, so a crashed
 * process can never leave a stale lock behind. We therefore reserve one
 * pool connection, hold it for the lifetime of `fn`, and release both the
 * lock and the connection in `finally`. `fn`'s own queries go through the
 * normal pool.
 *
 * Env overrides:
 *   HEAVY_DB_LOCK_NAME        lock name (default "udaman:heavy")
 *   HEAVY_DB_LOCK_TIMEOUT_MS  max wait before giving up (default 30 min)
 */
export const HEAVY_DB_LOCK_NAME =
  process.env.HEAVY_DB_LOCK_NAME ?? "udaman:heavy";

const DEFAULT_TIMEOUT_MS = Number(
  process.env.HEAVY_DB_LOCK_TIMEOUT_MS ?? 30 * 60 * 1000,
);

/** Poll slice: GET_LOCK blocks at most this long per call so we can log. */
const WAIT_SLICE_SEC = 60;

export class HeavyDbLockTimeoutError extends Error {
  constructor(holder: string, waitedMs: number) {
    super(
      `${holder}: could not acquire heavy DB lock "${HEAVY_DB_LOCK_NAME}" after ${Math.round(waitedMs / 1000)}s`,
    );
    this.name = "HeavyDbLockTimeoutError";
  }
}

export type HeavyDbLockOptions = {
  /** Max time to wait for the lock. Default HEAVY_DB_LOCK_TIMEOUT_MS. */
  timeoutMs?: number;
};

/**
 * Run `fn` while holding the heavy-DB advisory lock. Waits up to
 * `timeoutMs` (logging every minute), then throws
 * `HeavyDbLockTimeoutError` so the caller (usually a BullMQ job) fails
 * loudly instead of silently piling up.
 */
export async function withHeavyDbLock<T>(
  holder: string,
  fn: () => Promise<T>,
  opts: HeavyDbLockOptions = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const conn = await reserveConnection();
  const startedAt = performance.now();
  let acquired = false;

  try {
    // Acquire in ≤60s slices so a long wait is visible in the logs.
    for (;;) {
      const waitedMs = performance.now() - startedAt;
      const remainingSec = Math.ceil((timeoutMs - waitedMs) / 1000);
      if (remainingSec <= 0)
        throw new HeavyDbLockTimeoutError(holder, waitedMs);

      const slice = Math.min(WAIT_SLICE_SEC, remainingSec);
      const rows = (await conn.unsafe("SELECT GET_LOCK(?, ?) AS got", [
        HEAVY_DB_LOCK_NAME,
        slice,
      ])) as { got: number | null }[];
      const got = rows[0]?.got;

      if (got === 1) {
        acquired = true;
        break;
      }
      if (got === null || got === undefined) {
        throw new Error(`${holder}: GET_LOCK returned NULL (server error)`);
      }
      log.warn(
        {
          holder,
          waitedSec: Math.round((performance.now() - startedAt) / 1000),
        },
        "Waiting for heavy DB lock",
      );
    }

    const waitMs = +(performance.now() - startedAt).toFixed(0);
    log.info({ holder, waitMs }, "Heavy DB lock acquired");
    const runStart = performance.now();
    try {
      return await fn();
    } finally {
      log.info(
        { holder, heldMs: +(performance.now() - runStart).toFixed(0) },
        "Heavy DB lock released",
      );
    }
  } finally {
    try {
      if (acquired) {
        await conn.unsafe("SELECT RELEASE_LOCK(?)", [HEAVY_DB_LOCK_NAME]);
      }
    } catch (e) {
      // Connection release below drops the lock anyway.
      log.warn({ holder, err: String(e) }, "RELEASE_LOCK failed");
    }
    conn.release();
  }
}

/** Cheap health-check: is some process currently holding the heavy lock? */
export async function isHeavyDbLockHeld(): Promise<boolean> {
  const rows = await rawQuery<{ holder: number | null }>(
    "SELECT IS_USED_LOCK(?) AS holder",
    [HEAVY_DB_LOCK_NAME],
  );
  return rows[0]?.holder != null;
}
