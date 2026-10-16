/**
 * One BullMQ job scheduler per enabled data_downloaders row with a
 * `schedule` (cron, Pacific/Honolulu): key `scheduled:ingest-<handle>`,
 * job ingest.fetch. Schedulers for rows that were disabled, deleted or
 * unscheduled are removed. Runs at worker startup (production only, from
 * registerSchedules); call it again after editing a schedule.
 */

import DataDownloaderCollection from "@catalog/collections/data-downloader-collection";

import { createLogger } from "@/core/observability/logger";

import { defaultQueue, JobName } from "./queues";
import type { IngestFetchJobData } from "./queues";

const log = createLogger("worker.scheduler");

export const INGEST_SCHEDULER_PREFIX = "scheduled:ingest-";

export async function syncIngestSchedules(): Promise<string[]> {
  const tz = "Pacific/Honolulu";
  const wanted = new Map<string, { pattern: string; handle: string }>();
  for (const d of await DataDownloaderCollection.list()) {
    if (d.enabled && d.schedule) {
      wanted.set(`${INGEST_SCHEDULER_PREFIX}${d.handle}`, {
        pattern: d.schedule,
        handle: d.handle,
      });
    }
  }
  for (const s of await defaultQueue.getJobSchedulers()) {
    if (s.key.startsWith(INGEST_SCHEDULER_PREFIX) && !wanted.has(s.key)) {
      await defaultQueue.removeJobScheduler(s.key);
      log.info("Removed schedule %s", s.key);
    }
  }
  const registered: string[] = [];
  for (const [key, { pattern, handle }] of wanted) {
    try {
      await defaultQueue.upsertJobScheduler(
        key,
        { pattern, tz },
        {
          name: JobName.INGEST_FETCH,
          data: {
            handle,
            triggeredBy: "schedule",
          } satisfies IngestFetchJobData,
        },
      );
      registered.push(`${handle} (${pattern})`);
    } catch (e) {
      // a bad cron pattern on one row must not stop the others
      log.error(
        { handle, pattern, err: e instanceof Error ? e.message : String(e) },
        "could not register ingest schedule",
      );
    }
  }
  log.info("Registered ingest schedules: %s", registered.join(", ") || "none");
  return registered;
}
