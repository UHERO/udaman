import {
  dbedtUploadConfig,
  dbedtUploadHandlers,
} from "@catalog/controllers/dbedt-upload";
import { executeUpload } from "@catalog/controllers/universe-upload";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import type { DbedtUploadJobData } from "../queues";

const log = createLogger("worker.dbedt-upload");

export async function processDbedtUpload(
  job: Job<DbedtUploadJobData>,
): Promise<string> {
  const { uploadId, filePath } = job.data;
  log.info({ uploadId, filePath }, "Starting DBEDT upload processing");
  job.log(`Processing DBEDT upload ${uploadId}`);

  const result = await executeUpload(
    dbedtUploadConfig,
    uploadId,
    filePath,
    dbedtUploadHandlers,
  );

  const msg = `Loaded ${result.dataPointCount} data points`;
  job.log(`Complete: ${msg}`);
  log.info(
    { uploadId, dataPointCount: result.dataPointCount },
    "DBEDT upload complete",
  );
  return msg;
}
