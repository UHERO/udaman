import type { Logger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

// ─── Types ──────────────────────────────────────────────────────────

export type PipelineResult = {
  done: number;
  failed: number;
  total: number;
  skipped: number;
};

type ProcessOutcome = "done" | "skipped";

// ─── Progress summary ───────────────────────────────────────────────

export function progressSummary(
  done: number,
  failed: number,
  total: number,
  startMs: number,
): Record<string, unknown> {
  const processed = done + failed;
  const elapsedSec = (Date.now() - startMs) / 1000;
  const rate = elapsedSec > 0 ? processed / elapsedSec : 0;
  const remaining = total - processed;
  const etaSec = rate > 0 ? remaining / rate : 0;

  const fmtDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return {
    done,
    failed,
    total,
    pct: `${((processed / total) * 100).toFixed(1)}%`,
    rate: `${rate.toFixed(1)}/s`,
    elapsed: fmtDuration(elapsedSec),
    eta: fmtDuration(etaSec),
  };
}

// ─── Batch status updates ───────────────────────────────────────────

const SQL_BATCH_SIZE = 1000;

/** Bulk-set load_status='pending' for all TMKs before processing starts */
async function setAllPending(tmks: string[]): Promise<void> {
  for (let i = 0; i < tmks.length; i += SQL_BATCH_SIZE) {
    const batch = tmks.slice(i, i + SQL_BATCH_SIZE);
    const placeholders = batch.map(() => "?").join(",");
    await rawQuery(
      `UPDATE scrape_status SET load_status='pending', error=NULL WHERE tmk IN (${placeholders})`,
      batch,
    );
  }
}

/** Batch-update succeeded TMKs */
async function flushSuccess(tmks: string[]): Promise<void> {
  if (tmks.length === 0) return;
  for (let i = 0; i < tmks.length; i += SQL_BATCH_SIZE) {
    const batch = tmks.slice(i, i + SQL_BATCH_SIZE);
    const placeholders = batch.map(() => "?").join(",");
    await rawQuery(
      `UPDATE scrape_status SET load_status='success', loaded_at=NOW(), error=NULL WHERE tmk IN (${placeholders})`,
      batch,
    );
  }
}

/** Batch-update failed TMKs with their error messages */
async function flushFailed(
  failures: Array<{ tmk: string; error: string }>,
): Promise<void> {
  // Failed records need individual updates because each has a unique error
  for (const { tmk, error } of failures) {
    await rawQuery(
      `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
      [error.slice(0, 500), tmk],
    );
  }
}

// ─── Pipeline runner ────────────────────────────────────────────────

/**
 * Shared pipeline runner for all QPub run modes.
 *
 * 1. Sets ALL TMKs to pending upfront — dashboard shows full scope
 * 2. Processes TMKs, collecting results per batch (~10% of total)
 * 3. Flushes status updates at each batch boundary
 * 4. Final flush for remaining records
 */
export async function runPipeline(opts: {
  label: string;
  tmks: string[];
  processFn: (tmk: string) => Promise<ProcessOutcome>;
  log: Logger;
}): Promise<PipelineResult> {
  const { label, tmks, processFn, log } = opts;
  const total = tmks.length;

  if (total === 0) {
    log.info({ label }, "Pipeline: nothing to process");
    return { done: 0, failed: 0, total: 0, skipped: 0 };
  }

  log.info({ label, total }, "Pipeline: setting all to pending");
  await setAllPending(tmks);

  const batchInterval = Math.max(1, Math.floor(total * 0.1));
  const startMs = Date.now();

  let done = 0;
  let failed = 0;
  let skipped = 0;

  // Accumulators for the current batch
  let batchSuccess: string[] = [];
  let batchSkipped: string[] = [];
  let batchFailed: Array<{ tmk: string; error: string }> = [];

  const flush = async () => {
    await flushSuccess([...batchSuccess, ...batchSkipped]);
    await flushFailed(batchFailed);
    batchSuccess = [];
    batchSkipped = [];
    batchFailed = [];
  };

  for (let i = 0; i < tmks.length; i++) {
    const tmk = tmks[i];
    try {
      const outcome = await processFn(tmk);
      if (outcome === "skipped") {
        skipped++;
        batchSkipped.push(tmk);
      } else {
        done++;
        batchSuccess.push(tmk);
      }
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      batchFailed.push({ tmk, error: msg });
      log.error({ tmk, error: msg }, `${label}: failed`);
    }

    // Flush at ~10% intervals
    const processed = done + failed + skipped;
    if (processed % batchInterval === 0) {
      await flush();
      log.info(progressSummary(done + skipped, failed, total, startMs), `${label}: progress`);
    }
  }

  // Final flush for any remaining
  await flush();
  log.info(progressSummary(done + skipped, failed, total, startMs), `${label}: complete`);

  return { done, failed, total, skipped };
}
