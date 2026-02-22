import ReloadJobCollection from "@catalog/collections/reload-job-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("worker.purge-old");

export async function processPurgeOldStuff(job: Job): Promise<string> {
  log.info("Starting purge of old records");

  job.log("Purging old reload jobs...");
  const jobs = await ReloadJobCollection.purgeOldJobs(7);

  job.log("Purging old reload logs...");
  const reloadLogs = await ReloadJobCollection.purgeOldReloadLogs(14);

  job.log("Purging old DSD log entries...");
  const dsdLogs = await ReloadJobCollection.purgeOldDsdLogs(42); // 6 weeks

  const msg = `Purged ${jobs} jobs, ${reloadLogs} reload logs, ${dsdLogs} DSD logs`;
  job.log(msg);
  log.info("Purge complete");
  return msg;
}
