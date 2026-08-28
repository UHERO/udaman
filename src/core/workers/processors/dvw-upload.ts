import {
  type DvwDimensionMaps,
  dvwUploadConfig,
  dvwUploadHandlers,
  generateDvwDataToc,
  insertDvwDataChunk,
  loadDvwMetadata,
  wipeDvwUniverse,
} from "@catalog/controllers/dvw-upload";
import {
  type DvwStagedMeta,
  iterStagedChunks,
  readStagedMeta,
  removeStagedUpload,
} from "@catalog/controllers/upload-session-store";
import {
  executeUpload,
  type UploadHandlers,
} from "@catalog/controllers/universe-upload";
import type { DvwDataRow } from "@catalog/utils/dvw-xlsx-validator";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import { enqueueApiDvwReload } from "../enqueue";
import type { DvwUploadJobData } from "../queues";

const log = createLogger("worker.dvw-upload");

/**
 * Handlers for a *staged* upload: the client already parsed the XLSX and
 * the API route wrote the init payload + data chunks to `stagedDir`.
 * `parseFile` receives that directory instead of an XLSX path.
 */
const stagedHandlers: UploadHandlers = {
  parseFile: async (dir) => {
    const meta = await readStagedMeta<DvwStagedMeta>(dir);
    log.info(
      {
        dir,
        dimensions: Object.fromEntries(
          Object.entries(meta.dimensions).map(([k, v]) => [k, v.length]),
        ),
      },
      "Read staged DVW upload",
    );
    return { dir, meta };
  },
  wipeUniverse: wipeDvwUniverse,
  loadMetadata: async (parsed) => {
    const { meta } = parsed as { meta: DvwStagedMeta };
    return loadDvwMetadata(meta.dimensions);
  },
  loadData: async (parsed, metaContext) => {
    const { dir } = parsed as { dir: string };
    const dimMaps = metaContext as DvwDimensionMaps;
    let total = 0;
    let chunkNo = 0;
    for await (const rows of iterStagedChunks<DvwDataRow>(dir)) {
      total += await insertDvwDataChunk(rows, dimMaps);
      chunkNo++;
      if (chunkNo % 10 === 0) {
        log.info({ chunkNo, total }, "DVW staged insert progress");
      }
    }
    await generateDvwDataToc();
    log.info({ total }, "Loaded DVW data points from staged chunks");
    return total;
  },
};

export async function processDvwUpload(
  job: Job<DvwUploadJobData>,
): Promise<string> {
  const { uploadId, filePath, stagedDir } = job.data;
  log.info({ uploadId, filePath, stagedDir }, "Starting DVW upload processing");
  job.log(`Processing DVW upload ${uploadId}`);

  const result = await executeUpload(
    dvwUploadConfig,
    uploadId,
    stagedDir ?? filePath,
    stagedDir ? stagedHandlers : dvwUploadHandlers,
  );

  if (stagedDir) {
    await removeStagedUpload(stagedDir).catch((e) =>
      log.warn({ stagedDir, err: e }, "Failed to remove staged upload"),
    );
  }

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
