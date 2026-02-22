import DataPointCollection from "@catalog/collections/data-point-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/db";

import type { BatchReloadJobData } from "../queues";

const log = createLogger("worker.batch-reload");

/**
 * Nightly batch reload processor.
 * Ports the Rails `batch_reload_uhero` rake task.
 *
 * 1. Gets all UHERO series IDs
 * 2. Subtracts series matching the exclude searches (BLS, BEA, tour_ocup, SA)
 * 3. Calls SeriesCollection.batchReload() with the remaining IDs
 * 4. Calls DataPointCollection.updatePublicAllUniverses()
 */
export async function processBatchReload(
  job: Job<BatchReloadJobData>,
): Promise<string> {
  const { excludeSearches = [], updatePublic = true } = job.data;

  log.info("Starting nightly batch reload");
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

  await SeriesCollection.batchReload({
    seriesIds,
    suffix: "full",
    nightly: true,
    job,
  });

  let publicMsg = "";
  if (updatePublic) {
    job.log("Updating public data points...");
    await DataPointCollection.updatePublicAllUniverses();
    job.log("Public data points updated");
    publicMsg = "; updated public data points";
  }

  log.info("Nightly batch reload complete");
  return `Reloaded ${seriesIds.length} of ${totalCount} series${publicMsg}`;
}
