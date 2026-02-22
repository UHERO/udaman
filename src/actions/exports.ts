"use server";

import { revalidatePath } from "next/cache";
import {
  addSeriesToExport,
  createExport,
  deleteExport,
  getExport,
  getExportSeriesNames,
  getExportTableData,
  getExportWithSeries,
  listExports,
  moveExportSeries,
  removeSeriesFromExport,
  replaceAllExportSeries,
  updateExport,
} from "@catalog/controllers/exports";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.exports");

export async function listExportsAction() {
  return listExports();
}

export async function getExportAction(id: number) {
  return getExportWithSeries({ id });
}

export async function createExportAction(name: string): Promise<{
  success: boolean;
  message: string;
  id?: number;
}> {
  await requirePermission("series", "create");

  try {
    const exp = await createExport({ name });
    revalidatePath("/udaman", "layout");
    log.info({ id: exp.id }, "createExportAction completed");
    return { success: true, message: "Export created", id: exp.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "createExportAction failed");
    return { success: false, message: `Failed to create export: ${message}` };
  }
}

export async function updateExportAction(
  id: number,
  payload: { name?: string },
): Promise<{ success: boolean; message: string }> {
  await requirePermission("series", "update");

  try {
    await updateExport({ id, payload });
    revalidatePath("/udaman", "layout");
    log.info({ id }, "updateExportAction completed");
    return { success: true, message: "Export updated" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "updateExportAction failed");
    return { success: false, message: `Failed to update export: ${message}` };
  }
}

export async function addSeriesToExportAction(
  exportId: number,
  seriesId: number,
): Promise<{ success: boolean; message: string }> {
  await requirePermission("series", "update");

  try {
    await addSeriesToExport({ exportId, seriesId });
    revalidatePath("/udaman", "layout");
    log.info({ exportId, seriesId }, "addSeriesToExportAction completed");
    return { success: true, message: "Series added to export" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "addSeriesToExportAction failed");
    return { success: false, message: `Failed to add series: ${message}` };
  }
}

export async function removeSeriesFromExportAction(
  exportId: number,
  seriesId: number,
): Promise<{ success: boolean; message: string }> {
  await requirePermission("series", "update");

  try {
    await removeSeriesFromExport({ exportId, seriesId });
    revalidatePath("/udaman", "layout");
    log.info({ exportId, seriesId }, "removeSeriesFromExportAction completed");
    return { success: true, message: "Series removed from export" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "removeSeriesFromExportAction failed");
    return { success: false, message: `Failed to remove series: ${message}` };
  }
}

export async function moveExportSeriesAction(
  exportId: number,
  seriesId: number,
  direction: "up" | "down",
): Promise<{ success: boolean; message: string }> {
  await requirePermission("series", "update");

  try {
    await moveExportSeries({ exportId, seriesId, direction });
    revalidatePath("/udaman", "layout");
    log.info(
      { exportId, seriesId, direction },
      "moveExportSeriesAction completed",
    );
    return { success: true, message: `Series moved ${direction}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "moveExportSeriesAction failed");
    return { success: false, message: `Failed to move series: ${message}` };
  }
}

export async function replaceAllExportSeriesAction(
  exportId: number,
  seriesNames: string[],
): Promise<{ success: boolean; message: string }> {
  await requirePermission("series", "update");

  try {
    const result = await replaceAllExportSeries({ exportId, seriesNames });
    revalidatePath("/udaman", "layout");
    let msg = `Replaced with ${result.added} series`;
    if (result.notFound.length > 0) {
      msg += `. Not found: ${result.notFound.join(", ")}`;
    }
    log.info({ exportId }, "replaceAllExportSeriesAction completed");
    return { success: true, message: msg };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "replaceAllExportSeriesAction failed");
    return { success: false, message: `Failed to replace series: ${message}` };
  }
}

export async function getExportSeriesNamesAction(
  exportId: number,
): Promise<string[]> {
  return getExportSeriesNames({ exportId });
}

export async function getExportMetadataAction(id: number) {
  return getExport({ id });
}

export async function getExportTableDataAction(id: number) {
  return getExportTableData({ id });
}

export async function deleteExportAction(id: number): Promise<{
  success: boolean;
  message: string;
}> {
  await requirePermission("series", "delete");

  try {
    await deleteExport({ id });
    revalidatePath("/udaman", "layout");
    log.info({ id }, "deleteExportAction completed");
    return { success: true, message: "Export deleted" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "deleteExportAction failed");
    return { success: false, message: `Failed to delete export: ${message}` };
  }
}
