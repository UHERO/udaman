import { runKauaiExport } from "@catalog/utils/kauai-export";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("worker.kauai-export");

export async function processKauaiExport(job: Job): Promise<string> {
  log.info("Starting Kauai dashboard export");
  job.log("Exporting Kauai dashboard...");

  await runKauaiExport();

  job.log("Done");
  log.info("Kauai dashboard export complete");
  return "Kauai dashboard exported";
}
