"use server";

import { revalidatePath } from "next/cache";

import { createLogger } from "@/core/observability/logger";
import {
  listSnapshots,
  getSnapshot,
  createSnapshot,
  updateSnapshot,
  deleteSnapshot,
  getSnapshotData,
} from "@catalog/controllers/forecast-snapshots";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.forecast-snapshots");

export async function listSnapshotsAction() {
  return listSnapshots();
}

export async function getSnapshotAction(id: number) {
  return getSnapshot({ id });
}

export async function getSnapshotDataAction(id: number) {
  return getSnapshotData({ id });
}

export async function createSnapshotAction(formData: FormData): Promise<{
  success: boolean;
  message: string;
  id?: number;
}> {
  await requirePermission("series", "create");

  const name = formData.get("name") as string;
  const version = formData.get("version") as string;
  const published = formData.get("published") === "true";
  const comments = (formData.get("comments") as string) || null;

  if (!name || !version) {
    return { success: false, message: "Name and version are required" };
  }

  const newForecastFile = await extractFile(formData, "newForecastFile");
  const newForecastLabel = (formData.get("newForecastLabel") as string) || null;
  const oldForecastFile = await extractFile(formData, "oldForecastFile");
  const oldForecastLabel = (formData.get("oldForecastLabel") as string) || null;
  const historyFile = await extractFile(formData, "historyFile");
  const historyLabel = (formData.get("historyLabel") as string) || null;

  try {
    const result = await createSnapshot({
      name,
      version,
      published,
      comments,
      newForecastFile,
      newForecastLabel,
      oldForecastFile,
      oldForecastLabel,
      historyFile,
      historyLabel,
    });

    revalidatePath("/udaman", "layout");
    log.info({ id: result.id }, "createSnapshotAction completed");
    return { success: true, message: "Snapshot created", id: result.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "createSnapshotAction failed");
    return { success: false, message: `Failed to create snapshot: ${message}` };
  }
}

export async function updateSnapshotAction(
  id: number,
  formData: FormData,
): Promise<{
  success: boolean;
  message: string;
}> {
  await requirePermission("series", "update");

  const name = (formData.get("name") as string) || undefined;
  const version = (formData.get("version") as string) || undefined;
  const publishedRaw = formData.get("published");
  const published = publishedRaw !== null ? publishedRaw === "true" : undefined;
  const commentsRaw = formData.get("comments");
  const comments = commentsRaw !== null ? (commentsRaw as string) || null : undefined;

  const newForecastFile = await extractFile(formData, "newForecastFile");
  const newForecastLabel = formData.has("newForecastLabel")
    ? (formData.get("newForecastLabel") as string) || null
    : undefined;
  const oldForecastFile = await extractFile(formData, "oldForecastFile");
  const oldForecastLabel = formData.has("oldForecastLabel")
    ? (formData.get("oldForecastLabel") as string) || null
    : undefined;
  const historyFile = await extractFile(formData, "historyFile");
  const historyLabel = formData.has("historyLabel")
    ? (formData.get("historyLabel") as string) || null
    : undefined;

  try {
    await updateSnapshot({
      id,
      name,
      version,
      published,
      comments,
      newForecastFile,
      newForecastLabel,
      oldForecastFile,
      oldForecastLabel,
      historyFile,
      historyLabel,
    });

    revalidatePath("/udaman", "layout");
    log.info({ id }, "updateSnapshotAction completed");
    return { success: true, message: "Snapshot updated" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "updateSnapshotAction failed");
    return { success: false, message: `Failed to update snapshot: ${message}` };
  }
}

export async function deleteSnapshotAction(id: number): Promise<{
  success: boolean;
  message: string;
}> {
  await requirePermission("series", "delete");

  try {
    await deleteSnapshot({ id });
    revalidatePath("/udaman", "layout");
    log.info({ id }, "deleteSnapshotAction completed");
    return { success: true, message: "Snapshot deleted" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "deleteSnapshotAction failed");
    return { success: false, message: `Failed to delete snapshot: ${message}` };
  }
}

// ── Helpers ──

async function extractFile(
  formData: FormData,
  field: string,
): Promise<{ filename: string; content: string } | null> {
  const file = formData.get(field) as File | null;
  if (!file || file.size === 0) return null;
  const content = await file.text();
  return { filename: file.name, content };
}
