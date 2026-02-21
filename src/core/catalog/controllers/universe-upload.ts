import "server-only";

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
};

/**
 * Reusable orchestrator for universe-level data uploads.
 * Each universe provides handler callbacks for parsing, wiping, and loading.
 */
export async function orchestrateUpload(
  config: UploadConfig,
  fileBuffer: Buffer,
  originalFilename: string,
  handlers: UploadHandlers,
): Promise<UploadResult> {
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

  // Create upload record
  const upload = await uploadCollection.create(storedFilename);
  log.info(
    { uploadId: upload.id, filename: storedFilename },
    "Created upload record",
  );

  try {
    // Parse
    log.info({ uploadId: upload.id }, "Parsing uploaded file");
    const parsed = await handlers.parseFile(filePath);

    // Wipe
    log.info({ uploadId: upload.id }, "Wiping existing universe data");
    await handlers.wipeUniverse();

    // Load metadata
    log.info({ uploadId: upload.id }, "Loading metadata");
    const metaContext = await handlers.loadMetadata(parsed);

    // Load data
    log.info({ uploadId: upload.id }, "Loading data");
    const dataPointCount = await handlers.loadData(parsed, metaContext);

    // Activate this upload
    await uploadCollection.activate(upload.id);
    await uploadCollection.updateStatus(
      upload.id,
      "ok",
      `${dataPointCount} data points loaded`,
    );
    log.info(
      { uploadId: upload.id, dataPointCount },
      "Upload activated successfully",
    );

    // Refresh public data points
    log.info({ universe }, "Updating public data points");
    await DataPointCollection.updatePublicDataPoints(universe);

    // Clear cache (non-fatal)
    try {
      await ReloadJobCollection.runAdminAction("clear_cache");
      log.info("Cache cleared");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn({ err: msg }, "Cache clear failed (non-fatal)");
    }

    const message = `${universe} upload complete: ${dataPointCount} data points loaded`;
    return { uploadId: upload.id, dataPointCount, message };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    log.error({ uploadId: upload.id, err: errMsg }, "Upload failed");
    await uploadCollection.updateStatus(upload.id, "fail", errMsg);
    throw e;
  }
}
