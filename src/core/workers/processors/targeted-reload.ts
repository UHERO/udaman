import DataPointCollection from "@catalog/collections/data-point-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";
import { mysql } from "@/lib/mysql/db";

import type { TargetedReloadJobData } from "../queues";

const log = createLogger("worker.targeted-reload");

/**
 * Shared processor for all targeted reloads (BLS, BEA, tour_ocup, SA, VAP, UIC).
 * Job data carries { name, search, nightly, updatePublic, groupSize? }.
 *
 * For BLS reloads (name === "bls"), uses a batch POST path that groups up to
 * 50 series per API request and walks backwards for full history. Non-BLS
 * dependents (downstream arithmetic series) still use the standard eval path.
 *
 * For all other reloads:
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

  // ── BLS-specific batch path ──────────────────────────────────────
  if (name === "bls") {
    const blsMatchedSet = new Set(uniqueIds);
    const blsLoaders: Array<{
      blsSeriesId: string;
      frequency: string;
      loaderId: number;
      seriesId: number;
      xseriesId: number;
      scale: number;
      pseudoHistory: boolean;
    }> = [];
    const evalPathSeriesIds: number[] = [];

    // For each BLS-matched series, check if the loader is batch-eligible
    for (const seriesId of blsMatchedSet) {
      try {
        const loaders = await LoaderCollection.getEnabledBySeriesId(seriesId);
        for (const loader of loaders) {
          if (nightly && !loader.reloadNightly) continue;
          if (!loader.eval) continue;

          const parsed = LoaderCollection.parseBlsEval(loader.eval);
          if (parsed) {
            // Get xseries_id for this series
            const xsRows = await mysql<{ xseries_id: number }>`
              SELECT xseries_id FROM series WHERE id = ${seriesId} LIMIT 1
            `;
            const xseriesId = xsRows[0]?.xseries_id;
            if (!xseriesId) continue;

            blsLoaders.push({
              blsSeriesId: parsed.blsSeriesId,
              frequency: parsed.frequency,
              loaderId: loader.id,
              seriesId,
              xseriesId,
              scale: parseFloat(loader.scale),
              pseudoHistory: loader.pseudoHistory,
            });
          } else {
            // Non-batch-eligible loader (has method chaining, etc.)
            evalPathSeriesIds.push(seriesId);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        job.log(`Warning: Failed to get loaders for series ${seriesId}: ${msg}`);
      }
    }

    job.log(
      `BLS: ${blsLoaders.length} batch-eligible loaders, ${evalPathSeriesIds.length} eval-path loaders`,
    );

    // Batch-load BLS series
    if (blsLoaders.length > 0) {
      const blsResults = await SeriesCollection.batchLoadApiBls({
        loaders: blsLoaders,
        job,
      });
      const successes = blsResults.filter((r) => r.status === "success").length;
      const errors = blsResults.filter((r) => r.status === "error").length;
      job.log(`BLS batch: ${successes} succeeded, ${errors} failed`);
    }

    // Non-BLS dependents: series in fullSet that aren't in the BLS matched set
    const nonBlsDepIds = fullSet.filter((id) => !blsMatchedSet.has(id));
    // Also include any eval-path series
    const reloadIds = [...new Set([...nonBlsDepIds, ...evalPathSeriesIds])];

    if (reloadIds.length > 0) {
      job.log(`Reloading ${reloadIds.length} non-BLS dependent series via eval path...`);
      await SeriesCollection.batchReload({
        seriesIds: reloadIds,
        suffix: name,
        nightly,
        groupSize,
        job,
      });
    }
  } else {
    // ── Standard path for non-BLS reloads ─────────────────────────
    await SeriesCollection.batchReload({
      seriesIds: fullSet,
      suffix: name,
      nightly,
      groupSize,
      job,
    });
  }

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
