import LoaderCollection from "@catalog/collections/loader-collection";
import type { Job } from "bullmq";

import type { SeriesReloadJobData } from "../queues";

export async function processSeriesReload(
  job: Job<SeriesReloadJobData>,
): Promise<string> {
  const { loaderId, clearFirst } = job.data;

  const loader = await LoaderCollection.getById(loaderId);
  const result = await LoaderCollection.reload({ loader, clearFirst });

  job.log(`Reload ${result.status}: ${result.message}`);
  return `${result.status}: ${result.message}`;
}
