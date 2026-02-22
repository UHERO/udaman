import DownloadCollection from "@catalog/collections/download-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import type { DownloadJobData } from "../queues";

const log = createLogger("worker.download");

export async function processDownload(
  job: Job<DownloadJobData>,
): Promise<string> {
  const { handle } = job.data;

  log.info({ handle }, `Downloading ${handle}`);
  job.log(`Downloading ${handle}...`);

  const result = await DownloadCollection.downloadByHandle(handle);

  job.log(`Done — status=${result.status}, changed=${result.changed}`);
  log.info({ handle, ...result }, "Download complete");
  return `${handle}: ${result.changed ? "data changed" : "no changes"} (${result.status})`;
}
