import { runTsdExport } from "@catalog/utils/tsd-export";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import type { TsdExportJobData } from "../queues";

const log = createLogger("worker.tsd-export");

export async function processTsdExport(
  _job: Job<TsdExportJobData>,
): Promise<string> {
  const start = Date.now();
  log.info({ startedAt: new Date().toISOString() }, "Starting TSD export");
  const result = await runTsdExport();
  const durationMs = Date.now() - start;
  log.info(
    {
      success: result.success,
      message: result.message,
      durationMs,
      finishedAt: new Date().toISOString(),
    },
    "TSD export complete",
  );
  return (
    result.message || (result.success ? "Export complete" : "Export failed")
  );
}
