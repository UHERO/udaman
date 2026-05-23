import type { Job } from "bullmq";

import type { QpubReparseJobData } from "../queues";
import { rebuildTable } from "./qpub-rebuild";

/**
 * BullMQ job wrapper for rebuild-table.
 * Delegates to the standalone rebuildTable() function.
 */
export async function processQpubReparse(
  job: Job<QpubReparseJobData>,
): Promise<string> {
  const { table, island, period, batchSize = 500 } = job.data;
  return rebuildTable(table, { island, period, batchSize });
}
