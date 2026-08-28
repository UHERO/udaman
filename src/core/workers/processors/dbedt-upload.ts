import {
  dbedtUploadConfig,
  dbedtUploadHandlers,
  loadDbedtData,
  loadDbedtMetadata,
  wipeDbedtUniverse,
} from "@catalog/controllers/dbedt-upload";
import {
  type DbedtStagedMeta,
  readAllStagedRows,
  readStagedMeta,
  removeStagedUpload,
} from "@catalog/controllers/upload-session-store";
import {
  executeUpload,
  type UploadHandlers,
} from "@catalog/controllers/universe-upload";
import type {
  DbedtDataRow,
  DbedtMetaRow,
} from "@catalog/utils/dbedt-xlsx-parser";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import type { DbedtUploadJobData } from "../queues";

const log = createLogger("worker.dbedt-upload");

/**
 * Handlers for a *staged* upload: the client already parsed the XLSX and
 * the API route wrote the init payload + data chunks to `stagedDir`.
 * `parseFile` receives that directory instead of an XLSX path.
 *
 * DBEDT's loader needs a single sequential pass over all rows (series are
 * created on name change), so the staged chunks are materialised into one
 * array here — in the worker, not the web process.
 */
const stagedHandlers: UploadHandlers = {
  parseFile: async (dir) => {
    const meta = await readStagedMeta<DbedtStagedMeta>(dir);
    log.info(
      { dir, indicatorRows: meta.indicatorRows.length },
      "Read staged DBEDT upload",
    );
    return { dir, meta };
  },
  wipeUniverse: wipeDbedtUniverse,
  loadMetadata: async (parsed) => {
    const { meta } = parsed as { meta: DbedtStagedMeta };
    return loadDbedtMetadata(meta.indicatorRows);
  },
  loadData: async (parsed, metaContext) => {
    const { dir } = parsed as { dir: string };
    const rows = await readAllStagedRows<DbedtDataRow>(dir);
    log.info({ rows: rows.length }, "Loaded staged DBEDT data rows");
    return loadDbedtData(rows, metaContext as Map<number, DbedtMetaRow>);
  },
};

export async function processDbedtUpload(
  job: Job<DbedtUploadJobData>,
): Promise<string> {
  const { uploadId, filePath, stagedDir } = job.data;
  log.info(
    { uploadId, filePath, stagedDir },
    "Starting DBEDT upload processing",
  );
  job.log(`Processing DBEDT upload ${uploadId}`);

  const result = await executeUpload(
    dbedtUploadConfig,
    uploadId,
    stagedDir ?? filePath,
    stagedDir ? stagedHandlers : dbedtUploadHandlers,
  );

  if (stagedDir) {
    await removeStagedUpload(stagedDir).catch((e) =>
      log.warn({ stagedDir, err: e }, "Failed to remove staged upload"),
    );
  }

  const msg = `Loaded ${result.dataPointCount} data points`;
  job.log(`Complete: ${msg}`);
  log.info(
    { uploadId, dataPointCount: result.dataPointCount },
    "DBEDT upload complete",
  );
  return msg;
}
