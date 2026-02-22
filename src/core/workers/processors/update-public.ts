import DataPointCollection from "@catalog/collections/data-point-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import type { UpdatePublicJobData } from "../queues";

const log = createLogger("worker.update-public");

export async function processUpdatePublic(
  job: Job<UpdatePublicJobData>,
): Promise<string> {
  const { universe } = job.data;

  if (universe) {
    log.info({ universe }, "Updating public data points for universe");
    await DataPointCollection.updatePublicDataPoints(universe);
    const msg = `Updated public data points for ${universe}`;
    job.log(msg);
    log.info("Public data points update complete");
    return msg;
  } else {
    log.info("Updating public data points for all universes");
    await DataPointCollection.updatePublicAllUniverses();
    const msg = "Updated public data points for all universes";
    job.log(msg);
    log.info("Public data points update complete");
    return msg;
  }
}
