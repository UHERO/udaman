import DataPointCollection from "@catalog/collections/data-point-collection";
import type { Job } from "bullmq";

import { withHeavyDbLock } from "@/lib/mysql/db-lock";

import type { UpdatePublicJobData } from "../queues";

/**
 * Public data sweep. Takes the heavy DB lock itself (instead of the
 * generic `heavy()` wrapper in processors/index.ts) so it can pass the
 * lock's yieldPoint into the chunk loop: when a priority job (upload) is
 * waiting, the sweep releases the lock between chunks and re-queues
 * behind it, instead of holding the lock for the whole pass and forcing
 * the upload into a 30-minute timeout.
 */
export async function processUpdatePublic(
  job: Job<UpdatePublicJobData>,
): Promise<string> {
  const { universe } = job.data;

  return withHeavyDbLock(
    `${job.name}#${job.id ?? "?"}`,
    async ({ yieldPoint }) => {
      if (universe) {
        job.log(`Starting public data points update for ${universe}`);
        await DataPointCollection.updatePublicDataPoints(universe, {
          yieldPoint,
        });
        const msg = `Completed public data points update for ${universe}`;
        job.log(msg);
        return msg;
      } else {
        job.log("Starting public data points update for all universes");
        await DataPointCollection.updatePublicAllUniverses({ yieldPoint });
        const msg = "Completed public data points update for all universes";
        job.log(msg);
        return msg;
      }
    },
  );
}
