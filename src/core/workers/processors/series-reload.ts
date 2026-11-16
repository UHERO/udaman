import LoaderCollection from "@catalog/collections/loader-collection";
import type { Job } from "bullmq";

import { verifyAfterReload } from "@/core/ops/issues";

import type { SeriesReloadJobData } from "../queues";

export async function processSeriesReload(
  job: Job<SeriesReloadJobData>,
): Promise<string> {
  const { loaderId, clearFirst, opsIssueId } = job.data;

  const loader = await LoaderCollection.getById(loaderId);
  const result = await LoaderCollection.reload({ loader, clearFirst });

  job.log(`Reload ${result.status}: ${result.message}`);
  // An ops issue queued this reload to verify a fix: check it now.
  if (opsIssueId) {
    await verifyAfterReload(opsIssueId, result);
  }
  return `${result.status}: ${result.message}`;
}
