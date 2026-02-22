import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createLogger } from "@/core/observability/logger";
import { getDataDir } from "@/lib/data-dir";

import DataPointCollection from "../collections/data-point-collection";
import ReloadJobCollection from "../collections/reload-job-collection";
import type { UniverseUploadCollection } from "../collections/universe-upload-collection";
import type { Universe } from "../types/shared";

const log = createLogger("catalog.universe-upload");

export type UploadResult = {
  uploadId: number;
  dataPointCount: number;
  message: string;
};

export type UploadHandlers = {
  parseFile: (filePath: string) => Promise<unknown>;
  wipeUniverse: () => Promise<void>;
  loadMetadata: (parsed: unknown) => Promise<unknown>;
  loadData: (parsed: unknown, metaContext: unknown) => Promise<number>;
};

export type UploadConfig = {
  universe: Universe;
  fileSubdir: string;
  uploadCollection: typeof UniverseUploadCollection;
  skipPublicDataPoints?: boolean;
};

/**
 * Phase 1: Save file to disk and create the upload DB record.
 * Runs in the API route (fast). Returns the uploadId and filePath
 * for enqueueing the background processing job.
 */
export async function prepareUpload(
  config: UploadConfig,
  fileBuffer: Buffer,
  originalFilename: string,
): Promise<{ uploadId: number; filePath: string }> {
  const { universe, fileSubdir, uploadCollection } = config;

  // Generate timestamped filename
  const now = new Date();
  const ts = now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const ext = originalFilename.split(".").pop() ?? "xlsx";
  const storedFilename = `econ_${ts}_upload.${ext}`;

  // Save file to disk
  const dir = join(getDataDir(), fileSubdir);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, storedFilename);
  await writeFile(filePath, fileBuffer);
  log.info({ filePath, universe }, "Saved upload file to disk");

  // Create upload record (status = "processing")
  const upload = await uploadCollection.create(storedFilename);
  log.info(
    { uploadId: upload.id, filename: storedFilename },
    "Created upload record",
  );

  return { uploadId: upload.id, filePath };
}

/**
 * Phase 2: Parse, wipe, load metadata, load data, activate.
 * Runs in the worker process (long-running).
 */
export async function executeUpload(
  config: UploadConfig,
  uploadId: number,
  filePath: string,
  handlers: UploadHandlers,
): Promise<UploadResult> {
  const { universe, uploadCollection } = config;

  try {
    // Parse
    log.info({ uploadId }, "Parsing uploaded file");
    const parsed = await handlers.parseFile(filePath);

    // Wipe
    log.info({ uploadId }, "Wiping existing universe data");
    await handlers.wipeUniverse();

    // Load metadata
    log.info({ uploadId }, "Loading metadata");
    const metaContext = await handlers.loadMetadata(parsed);

    // Load data
    log.info({ uploadId }, "Loading data");
    const dataPointCount = await handlers.loadData(parsed, metaContext);

    // Activate this upload
    await uploadCollection.activate(uploadId);
    await uploadCollection.updateStatus(
      uploadId,
      "ok",
      `${dataPointCount} data points loaded`,
    );
    log.info({ uploadId, dataPointCount }, "Upload activated successfully");

    // Refresh public data points (skip for DVW — uses a separate DB)
    if (!config.skipPublicDataPoints) {
      log.info({ universe }, "Updating public data points");
      await DataPointCollection.updatePublicDataPoints(universe);
    }

    // Clear cache (non-fatal)
    try {
      await ReloadJobCollection.runAdminAction("clear_cache");
      log.info("Cache cleared");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn({ err: msg }, "Cache clear failed (non-fatal)");
    }

    const message = `${universe} upload complete: ${dataPointCount} data points loaded`;
    return { uploadId, dataPointCount, message };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    log.error({ uploadId, err: errMsg }, "Upload failed");
    await uploadCollection.updateStatus(uploadId, "fail", errMsg);
    throw e;
  }
}
