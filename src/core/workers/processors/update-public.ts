import DataPointCollection from "@catalog/collections/data-point-collection";
import type { Job } from "bullmq";

import type { UpdatePublicJobData } from "../queues";

export async function processUpdatePublic(
  job: Job<UpdatePublicJobData>,
): Promise<string> {
  const { universe } = job.data;

  if (universe) {
    job.log(`Starting public data points update for ${universe}`);
    await DataPointCollection.updatePublicDataPoints(universe);
    const msg = `Completed public data points update for ${universe}`;
    job.log(msg);
    return msg;
  } else {
    job.log("Starting public data points update for all universes");
    await DataPointCollection.updatePublicAllUniverses();
    const msg = "Completed public data points update for all universes";
    job.log(msg);
    return msg;
  }
}
