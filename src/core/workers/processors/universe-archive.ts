import UniverseCollection from "@catalog/collections/universe-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import type { UniverseArchiveJobData } from "../queues";

const log = createLogger("worker.universe-archive");

export async function processUniverseArchive(
  job: Job<UniverseArchiveJobData>,
): Promise<string> {
  const { universe } = job.data;
  const start = Date.now();
  log.info({ universe }, "Starting universe archive");
  job.log(`Archiving universe ${universe}...`);

  const archiveDir = await UniverseCollection.archiveToCsv(universe);

  const durationMs = Date.now() - start;
  const msg = `Archive complete: ${archiveDir} (${durationMs}ms)`;
  log.info({ universe, archiveDir, durationMs }, msg);
  job.log(msg);
  return msg;
}
