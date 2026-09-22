import { AppLogCollection } from "@catalog/collections/app-log-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/db";
import type { HeavyDbLockContext } from "@/lib/mysql/db-lock";

import { enqueueUpdatePublic } from "../enqueue";
import type { BatchReloadJobData } from "../queues";

const log = createLogger("worker.batch-reload");

/**
 * Nightly batch reload processor.
 * Ports the Rails `batch_reload_uhero` rake task.
 *
 * 1. Gets all UHERO series IDs
 * 2. Subtracts series matching the exclude searches (BLS, BEA, tour_ocup, SA)
 * 3. Calls SeriesCollection.batchReload() with the remaining IDs
 * 4. Enqueues the deduplicated UPDATE_PUBLIC sweep job (never inline —
 *    see the same note in targeted-reload.ts)
 */
export async function processBatchReload(
  job: Job<BatchReloadJobData>,
  ctx?: HeavyDbLockContext,
): Promise<string> {
  const { excludeSearches = [], updatePublic = true } = job.data;
  const t0 = Date.now();

  log.info({ lockWaitMs: ctx?.waitMs }, "Starting nightly batch reload");
  job.log("Gathering UHERO series...");

  // Get all UHERO series IDs
  const allRows = await rawQuery<{ id: number }>(
    `SELECT id FROM series WHERE universe = 'UHERO'`,
  );
  let seriesIds = allRows.map((r) => r.id);
  const totalCount = seriesIds.length;
  job.log(`Total UHERO series: ${totalCount}`);

  // Default excludes if none provided
  const searches =
    excludeSearches.length > 0
      ? excludeSearches
      : ["#load_api_bls", "#load_api_bea", "#tour_ocup%Y", "#sa_jobs.csv"];

  // Subtract series that have their own reload schedules
  for (const search of searches) {
    try {
      const excluded = await SeriesCollection.search({
        text: search,
        universe: "UHERO",
      });
      const excludeIds = new Set(excluded.map((s) => s.id!));
      const before = seriesIds.length;
      seriesIds = seriesIds.filter((id) => !excludeIds.has(id));
      job.log(
        `Excluded ${before - seriesIds.length} series matching "${search}"`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      job.log(`Warning: Failed to search "${search}": ${msg}`);
      log.warn({ search, err: msg }, "Exclude search failed");
    }
  }

  job.log(`Reloading ${seriesIds.length} series...`);

  const { perDepth } = await SeriesCollection.batchReload({
    seriesIds,
    suffix: "full",
    nightly: true,
    job,
    yieldPoint: ctx?.yieldPoint,
  });

  let publicMsg = "";
  if (updatePublic) {
    await enqueueUpdatePublic();
    job.log("Queued public data points update");
    publicMsg = "; queued public data points update";
  }

  const elapsedSec = Math.round((Date.now() - t0) / 1000);
  const failed = perDepth.reduce((n, d) => n + d.failed, 0);
  log.info({ elapsedSec, failed, perDepth }, "Nightly batch reload complete");

  // Durations land in app_logs so the nightly's trend is visible in the
  // admin UI: one summary row, plus one row per depth level.
  AppLogCollection.log({
    category: "loader",
    name: "loader.batch_reload",
    metadata: {
      reloaded: seriesIds.length,
      total: totalCount,
      failed,
      lockWaitMs: ctx?.waitMs ?? null,
      elapsedSec,
      perDepth,
    },
  });
  for (const d of perDepth) {
    AppLogCollection.log({
      category: "loader",
      name: "loader.batch_reload.depth",
      metadata: d,
    });
  }

  return `Reloaded ${seriesIds.length} of ${totalCount} series in ${elapsedSec}s (${failed} failed)${publicMsg}`;
}
