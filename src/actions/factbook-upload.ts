"use server";

import { revalidatePath } from "next/cache";
import {
  runFactbookUpload,
  type FactbookUploadResult,
} from "@catalog/controllers/factbook-upload";
import {
  previewFactbook,
  type FactbookPreview,
} from "@catalog/utils/factbook-parser";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.factbook-upload");

export type FactbookPreviewResult =
  | { success: true; preview: FactbookPreview }
  | { success: false; message: string };

/** Read the factbook file at DATA_DIR/factbooktablelong.txt and return summary stats. */
export async function previewFactbookAction(): Promise<FactbookPreviewResult> {
  await requirePermission("upload", "read");

  try {
    const preview = await previewFactbook();
    return { success: true, preview };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "previewFactbookAction failed");
    return { success: false, message };
  }
}

export type FactbookUploadActionResult =
  | { success: true; message: string; result: FactbookUploadResult }
  | { success: false; message: string };

/**
 * Run the full factbook upload pipeline: upsert metadata (categories,
 * geographies, measurements, series, loaders) and replace all HHF data points
 * with the contents of the file.
 */
export async function runFactbookUploadAction(): Promise<FactbookUploadActionResult> {
  await requirePermission("series", "create");

  log.info("runFactbookUploadAction: start");
  try {
    const result = await runFactbookUpload();

    revalidatePath("/udaman/HHF/series");
    revalidatePath("/udaman/HHF/catalog/categories");
    revalidatePath("/udaman/HHF/catalog/measurements");
    revalidatePath("/udaman/HHF/catalog/geographies");

    const summary =
      `Inserted ${result.dataPointsInserted.toLocaleString()} data points ` +
      `across ${result.seriesCreated + result.seriesExisting} series ` +
      `(${result.seriesCreated} new). ` +
      `${result.measurementsCreated} new measurements, ` +
      `${result.geographiesCreated} new geographies, ` +
      `${result.unmappedMeasurements} assigned to unmapped.`;

    log.info(result, "runFactbookUploadAction: done");
    return { success: true, message: summary, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "runFactbookUploadAction failed");
    return { success: false, message: `Factbook upload failed: ${message}` };
  }
}
