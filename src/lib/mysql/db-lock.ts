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
 * Priority + yield: short interactive jobs (the tour/econ uploads) pass
 * `{ priority: true }`, which raises a "yield requested" flag — a second
 * advisory lock held while they wait for the main one. Long cooperative
 * holders (the public data sweep) call `ctx.yieldPoint()` between chunks:
 * when the flag is up they release the main lock, wait for the priority
 * job to take it, and queue up behind it. Because the flag is itself a
 * GET_LOCK, a crashed priority waiter can never leave it stuck. If two
 * priority jobs wait at once only one holds the flag; the other just
 * waits normally — acceptable, since the flag is already raised.
 *
 * Env overrides:
 *   HEAVY_DB_LOCK_NAME        lock name (default "udaman:heavy")
 *   HEAVY_DB_LOCK_TIMEOUT_MS  max wait before giving up (default 30 min)
 */
export const HEAVY_DB_LOCK_NAME =
  process.env.HEAVY_DB_LOCK_NAME ?? "udaman:heavy";

/** "A priority job is waiting" flag, implemented as a second GET_LOCK. */
export const HEAVY_DB_LOCK_YIELD_NAME = `${HEAVY_DB_LOCK_NAME}:yield`;

const DEFAULT_TIMEOUT_MS = Number(
  process.env.HEAVY_DB_LOCK_TIMEOUT_MS ?? 30 * 60 * 1000,
);

/** Poll slice: GET_LOCK blocks at most this long per call so we can log. */
const WAIT_SLICE_SEC = 60;

/** How often a yielded holder re-checks the flag before re-queuing. */
const YIELD_POLL_MS = 2000;

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
  /**
   * Raise the yield flag while waiting, so cooperative holders release
   * the lock at their next `yieldPoint()`. For short interactive jobs
   * only — a priority job should never itself run for a long time.
   */
  priority?: boolean;
};

export type HeavyDbLockContext = {
  /**
   * Cooperative yield: cheap no-op unless a priority job is waiting, in
   * which case the main lock is released, the priority job runs, and this
   * call returns once the lock is re-acquired. Call between chunks of
   * long work; everything before and after must tolerate the gap.
   */
  yieldPoint: () => Promise<void>;
};

/**
 * Run `fn` while holding the heavy-DB advisory lock. Waits up to
 * `timeoutMs` (logging every minute), then throws
 * `HeavyDbLockTimeoutError` so the caller (usually a BullMQ job) fails
 * loudly instead of silently piling up.
 */
export async function withHeavyDbLock<T>(
  holder: string,
  fn: (ctx: HeavyDbLockContext) => Promise<T>,
  opts: HeavyDbLockOptions = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const conn = await reserveConnection();
  let acquired = false;
  let holdsYieldFlag = false;

  const getLock = async (
    name: string,
    waitSec: number,
  ): Promise<number | null> => {
    const rows = (await conn.unsafe("SELECT GET_LOCK(?, ?) AS got", [
      name,
      waitSec,
    ])) as { got: number | null }[];
    return rows[0]?.got ?? null;
  };

  const yieldFlagRaised = async (): Promise<boolean> => {
    const rows = (await conn.unsafe("SELECT IS_USED_LOCK(?) AS holder", [
      HEAVY_DB_LOCK_YIELD_NAME,
    ])) as { holder: number | null }[];
    return rows[0]?.holder != null;
  };

  /** Acquire the main lock in ≤60s slices so a long wait is visible. */
  const acquireMain = async (budgetMs: number): Promise<void> => {
    const t0 = performance.now();
    for (;;) {
      const waitedMs = performance.now() - t0;
      const remainingSec = Math.ceil((budgetMs - waitedMs) / 1000);
      if (remainingSec <= 0) throw new HeavyDbLockTimeoutError(holder, waitedMs);

      const slice = Math.min(WAIT_SLICE_SEC, remainingSec);
      const got = await getLock(HEAVY_DB_LOCK_NAME, slice);
      if (got === 1) {
        acquired = true;
        return;
      }
      if (got === null) {
        throw new Error(`${holder}: GET_LOCK returned NULL (server error)`);
      }
      log.warn(
        { holder, waitedSec: Math.round((performance.now() - t0) / 1000) },
        "Waiting for heavy DB lock",
      );
    }
  };

  const yieldPoint = async (): Promise<void> => {
    if (!acquired) return;
    if (!(await yieldFlagRaised())) return;

    log.info({ holder }, "Heavy DB lock yielded to priority waiter");
    await conn.unsafe("SELECT RELEASE_LOCK(?)", [HEAVY_DB_LOCK_NAME]);
    acquired = false;

    // The priority job drops the flag once it holds the main lock; wait
    // for that before re-queuing so we can't snatch the lock back first.
    // Bounded so a zombie flag-holder (half-open connection) can't park
    // us forever — worst case we just contend normally again.
    const pollDeadline = performance.now() + timeoutMs;
    while (performance.now() < pollDeadline) {
      if (!(await yieldFlagRaised())) break;
      await Bun.sleep(YIELD_POLL_MS);
    }

    await acquireMain(timeoutMs);
    log.info({ holder }, "Heavy DB lock re-acquired after yield");
  };

  const startedAt = performance.now();
  try {
    if (opts.priority) {
      // 0-timeout: if another priority waiter already holds the flag it
      // stays up on their behalf, which is all we need.
      holdsYieldFlag = (await getLock(HEAVY_DB_LOCK_YIELD_NAME, 0)) === 1;
    }

    await acquireMain(timeoutMs);

    if (holdsYieldFlag) {
      await conn.unsafe("SELECT RELEASE_LOCK(?)", [HEAVY_DB_LOCK_YIELD_NAME]);
      holdsYieldFlag = false;
    }

    const waitMs = +(performance.now() - startedAt).toFixed(0);
    log.info({ holder, waitMs }, "Heavy DB lock acquired");
    const runStart = performance.now();
    try {
      return await fn({ yieldPoint });
    } finally {
      log.info(
        { holder, heldMs: +(performance.now() - runStart).toFixed(0) },
        "Heavy DB lock released",
      );
    }
  } finally {
    try {
      if (holdsYieldFlag) {
        await conn.unsafe("SELECT RELEASE_LOCK(?)", [
          HEAVY_DB_LOCK_YIELD_NAME,
        ]);
      }
      if (acquired) {
        await conn.unsafe("SELECT RELEASE_LOCK(?)", [HEAVY_DB_LOCK_NAME]);
      }
    } catch (e) {
      // Connection release below drops the lock anyway.
      log.warn({ holder, err: String(e) }, "RELEASE_LOCK failed");
    }
    try {
      conn.release();
    } catch (e) {
      // A connection the server already closed throws here. The lock died
      // with the connection, so there is nothing left to clean up — and
      // this must never escape: an uncaught throw in a finally took the
      // whole worker process down on 2026-08-27.
      log.warn(
        { holder, err: String(e) },
        "reserved connection release failed",
      );
    }
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
