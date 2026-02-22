import DataPointCollection from "@catalog/collections/data-point-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";
import { mysql, rawQuery } from "@/lib/mysql/db";

import type { ReloadJobData } from "../queues";

const log = createLogger("worker.reload-job");

interface ReloadJobRow {
  id: number;
  params: string | null;
  update_public: boolean | number | null;
}

interface ReloadJobSeriesRow {
  series_id: number;
}

export async function processReloadJob(
  job: Job<ReloadJobData>,
): Promise<string> {
  const { reloadJobId } = job.data;

  // Fetch the reload job record
  const rows = await mysql<ReloadJobRow>`
    SELECT id, params, update_public FROM reload_jobs WHERE id = ${reloadJobId} LIMIT 1
  `;
  const reloadJob = rows[0];
  if (!reloadJob) throw new Error(`ReloadJob ${reloadJobId} not found`);

  // Mark as processing
  await mysql`UPDATE reload_jobs SET status = 'processing' WHERE id = ${reloadJobId}`;

  try {
    // Get associated series
    const seriesRows = await mysql<ReloadJobSeriesRow>`
      SELECT series_id FROM reload_job_series WHERE reload_job_id = ${reloadJobId}
    `;
    const seriesIds = seriesRows.map((r) => r.series_id);
    job.log(`Processing ${seriesIds.length} series`);
    log.info(
      { reloadJobId, seriesCount: seriesIds.length },
      "Processing reload job",
    );

    // Parse params for clear_first flag
    let clearFirst = false;
    if (reloadJob.params) {
      try {
        // Params may contain Ruby-style array string; extract clear_first if present
        clearFirst = reloadJob.params.includes("clear_first");
      } catch {
        // ignore parse errors
      }
    }

    // Reload each series' loaders
    let succeeded = 0;
    let failed = 0;
    for (const seriesId of seriesIds) {
      try {
        const loaders = await LoaderCollection.getBySeriesId(seriesId);
        for (const loader of loaders) {
          await LoaderCollection.reload({ loader, clearFirst });
        }
        succeeded++;
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        log.warn({ seriesId, err: msg }, "Series reload failed, continuing");
        job.log(`Series ${seriesId} failed: ${msg}`);
      }
    }

    // Update public data points if requested
    let publicMsg = "";
    if (reloadJob.update_public) {
      await DataPointCollection.updatePublicAllUniverses();
      job.log("Updated public data points");
      publicMsg = "; updated public data points";
    }

    // Mark as done
    await rawQuery(
      "UPDATE reload_jobs SET status = 'done', finished_at = NOW() WHERE id = ?",
      [reloadJobId],
    );
    log.info({ reloadJobId }, "Reload job completed");
    return `Reloaded ${succeeded} series (${failed} failed)${publicMsg}`;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await rawQuery(
      "UPDATE reload_jobs SET status = 'fail', finished_at = NOW(), error = ? WHERE id = ?",
      [errMsg.slice(0, 254), reloadJobId],
    );
    log.error({ reloadJobId, err: errMsg }, "Reload job failed");
    throw e;
  }
}
