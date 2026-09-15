import LoaderCollection from "@catalog/collections/loader-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("worker.dependency-reset");

export async function processDependencyReset(job: Job): Promise<string> {
  log.info("Starting dependency reset");

  job.log("Setting all loader dependencies...");
  await LoaderCollection.setAllDependencies();

  job.log("Computing dependency depths...");
  await SeriesCollection.assignDependencyDepth();

  job.log("Done");
  log.info("Dependency reset complete");
  return "Dependencies reset for all loaders";
}
