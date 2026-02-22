import { runTsdExport } from "@catalog/utils/tsd-export";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import type { TsdExportJobData } from "../queues";

const log = createLogger("worker.tsd-export");

export async function processTsdExport(
  _job: Job<TsdExportJobData>,
): Promise<string> {
  log.info("Starting TSD export");
  const result = await runTsdExport();
  log.info(
    { success: result.success, message: result.message },
    "TSD export complete",
  );
  return (
    result.message || (result.success ? "Export complete" : "Export failed")
  );
}
