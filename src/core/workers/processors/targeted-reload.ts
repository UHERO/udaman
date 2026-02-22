import DataPointCollection from "@catalog/collections/data-point-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import type { TargetedReloadJobData } from "../queues";

const log = createLogger("worker.targeted-reload");

/**
 * Shared processor for all targeted reloads (BLS, BEA, tour_ocup, SA, VAP, UIC).
 * Job data carries { name, search, nightly, updatePublic, groupSize? }.
 *
 * 1. Uses SeriesCollection.search() to find matching series
 * 2. Calls SeriesCollection.getAllDependencies() to expand to full dep tree
 * 3. Calls SeriesCollection.batchReload() with the full set
 * 4. Optionally calls DataPointCollection.updatePublicAllUniverses()
 */
export async function processTargetedReload(
  job: Job<TargetedReloadJobData>,
): Promise<string> {
  const { name, search, nightly, updatePublic, groupSize } = job.data;

  log.info({ name, search }, `Starting targeted reload: ${name}`);
  job.log(`Targeted reload "${name}" — searching: ${search}`);

  // Handle comma-separated searches (e.g. SA combines two queries)
  const searches = search
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allSeriesIds: number[] = [];

  for (const q of searches) {
    try {
      const results = await SeriesCollection.search({
        text: q,
        universe: "UHERO",
      });
      allSeriesIds.push(...results.map((s) => s.id!));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      job.log(`Warning: Search "${q}" failed: ${msg}`);
      log.warn({ name, search: q, err: msg }, "Search failed");
    }
  }

  // Deduplicate
  const uniqueIds = [...new Set(allSeriesIds)];

  if (uniqueIds.length === 0) {
    job.log("No series found — nothing to reload");
    log.warn({ name }, "No series found for targeted reload");
    return `No series found for "${name}"`;
  }

  job.log(`Found ${uniqueIds.length} series, expanding dependencies...`);

  // Expand to full dependency tree
  const fullSet = await SeriesCollection.getAllDependencies(uniqueIds);
  job.log(`Full dependency set: ${fullSet.length} series`);

  // Batch reload
  await SeriesCollection.batchReload({
    seriesIds: fullSet,
    suffix: name,
    nightly,
    groupSize,
    job,
  });

  let publicMsg = "";
  if (updatePublic) {
    job.log("Updating public data points...");
    await DataPointCollection.updatePublicAllUniverses();
    job.log("Public data points updated");
    publicMsg = "; updated public data points";
  }

  log.info({ name }, `Targeted reload "${name}" complete`);
  return `Reloaded ${fullSet.length} series (${uniqueIds.length} matched + deps)${publicMsg}`;
}
