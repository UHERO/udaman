import {
  dvwUploadConfig,
  dvwUploadHandlers,
} from "@catalog/controllers/dvw-upload";
import { executeUpload } from "@catalog/controllers/universe-upload";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import { enqueueApiDvwReload } from "../enqueue";
import type { DvwUploadJobData } from "../queues";

const log = createLogger("worker.dvw-upload");

export async function processDvwUpload(
  job: Job<DvwUploadJobData>,
): Promise<string> {
  const { uploadId, filePath } = job.data;
  log.info({ uploadId, filePath }, "Starting DVW upload processing");
  job.log(`Processing DVW upload ${uploadId}`);

  const result = await executeUpload(
    dvwUploadConfig,
    uploadId,
    filePath,
    dvwUploadHandlers,
  );

  job.log(`Complete: ${result.dataPointCount} data points loaded`);
  log.info(
    { uploadId, dataPointCount: result.dataPointCount },
    "DVW upload complete",
  );

  // Enqueue reload of UHERO series that use api_dvw data sources
  await enqueueApiDvwReload({ dvwUploadId: uploadId });
  job.log("Enqueued api_dvw reload");

  return `Loaded ${result.dataPointCount} data points; enqueued api_dvw reload`;
}
