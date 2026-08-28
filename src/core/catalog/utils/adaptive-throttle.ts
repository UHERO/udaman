/**
 * Adaptive throttle for bulk DB writes.
 *
 * Bulk loads (DBEDT/DVW uploads) share one small MySQL server with the
 * interactive app and the worker's reload/public-sync jobs. A fixed sleep
 * between batches doesn't back off when the server is already busy — the
 * batch just takes longer *and* we keep the same duty cycle. This helper
 * measures how long each batch actually took and sleeps proportionally, so
 * a loaded server automatically slows the upload down (roughly
 * `1 / (1 + factor)` of the time is spent writing) while an idle server
 * still moves at close to full speed.
 *
 * Tunables (env, all optional):
 *   UPLOAD_THROTTLE_FACTOR  — sleep = factor × last batch duration (default 1.5)
 *   UPLOAD_THROTTLE_MIN_MS  — floor on the sleep (default 50)
 *   UPLOAD_THROTTLE_MAX_MS  — ceiling on the sleep (default 2000)
 *
 * Setting UPLOAD_THROTTLE_FACTOR=0 degrades to a fixed MIN_MS sleep.
 */

export type ThrottleOptions = {
  factor?: number;
  minMs?: number;
  maxMs?: number;
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export class AdaptiveThrottle {
  private readonly factor: number;
  private readonly minMs: number;
  private readonly maxMs: number;
  private lastMs = 0;

  constructor(opts: ThrottleOptions = {}) {
    this.factor = opts.factor ?? envNumber("UPLOAD_THROTTLE_FACTOR", 1.5);
    this.minMs = opts.minMs ?? envNumber("UPLOAD_THROTTLE_MIN_MS", 50);
    this.maxMs = Math.max(
      this.minMs,
      opts.maxMs ?? envNumber("UPLOAD_THROTTLE_MAX_MS", 2000),
    );
  }

  /** Duration of the most recent timed unit of work, in ms. */
  get lastDurationMs(): number {
    return this.lastMs;
  }

  /** Sleep this throttle would apply right now, in ms. */
  get nextSleepMs(): number {
    const proportional = this.lastMs * this.factor;
    return Math.min(this.maxMs, Math.max(this.minMs, proportional));
  }

  /** Record an externally measured duration (ms) as the last unit of work. */
  record(durationMs: number): void {
    this.lastMs = Math.max(0, durationMs);
  }

  /** Run a unit of work and record how long it took. Does not sleep. */
  async time<T>(fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.lastMs = performance.now() - start;
    }
  }

  /** Sleep proportionally to the last timed unit of work. */
  async pause(): Promise<void> {
    await Bun.sleep(this.nextSleepMs);
  }

  /**
   * Run a unit of work, then sleep proportionally — unless `isLast` is set,
   * in which case the trailing sleep is skipped (no point delaying the
   * caller after the final batch of a chunk).
   */
  async run<T>(fn: () => Promise<T>, isLast = false): Promise<T> {
    const result = await this.time(fn);
    if (!isLast) await this.pause();
    return result;
  }
}
