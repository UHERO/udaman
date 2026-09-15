import LoaderCollection from "@catalog/collections/loader-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/db";

import type { ApiDvwReloadJobData } from "../queues";

const log = createLogger("worker.api-dvw-reload");

interface ApiDvwLoaderRow {
  id: number;
  series_id: number;
}

export async function processApiDvwReload(
  job: Job<ApiDvwReloadJobData>,
): Promise<string> {
  log.info({ dvwUploadId: job.data.dvwUploadId }, "Starting api_dvw reload");

  // Find all UHERO loaders with eval containing #api_dvw
  const rows = await rawQuery<ApiDvwLoaderRow>(
    `SELECT id, series_id FROM data_sources
     WHERE universe = 'UHERO' AND eval LIKE '%#api_dvw%' AND disabled = 0`,
  );

  job.log(`Found ${rows.length} api_dvw loaders to reload`);
  log.info({ count: rows.length }, "Found api_dvw loaders");

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const loader = await LoaderCollection.getById(row.id);
      await LoaderCollection.reload({ loader, clearFirst: true });
      succeeded++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      log.warn(
        { loaderId: row.id, seriesId: row.series_id, err: msg },
        "api_dvw reload failed",
      );
      job.log(`Loader ${row.id} (series ${row.series_id}) failed: ${msg}`);
    }
  }

  const summary = `${succeeded} succeeded, ${failed} failed of ${rows.length} loaders`;
  job.log(`api_dvw reload complete: ${summary}`);
  log.info({ succeeded, failed }, "api_dvw reload complete");
  return summary;
}
