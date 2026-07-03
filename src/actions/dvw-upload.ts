"use server";

import { DvwUploadCollection } from "@catalog/collections/universe-upload-collection";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.dvw-upload");

export async function getDvwUploadsAction() {
  await requirePermission("upload", "read");
  const uploads = await DvwUploadCollection.list();
  return uploads.map((u) => u.toJSON());
}

export async function getDvwUploadStatusAction(id: number) {
  await requirePermission("upload", "read");
  try {
    const upload = await DvwUploadCollection.getById(id);
    return upload.toJSON();
  } catch {
    return null;
  }
}

export async function cancelDvwUploadAction(id: number) {
  const { userId } = await requirePermission("upload", "create");
  log.info({ id }, "cancelDvwUploadAction called");
  try {
    await DvwUploadCollection.updateStatus(id, "fail", "Cancelled by user");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "cancelDvwUploadAction failed");
    AppLogCollection.logError(err, { userId, name: "dvw-upload.cancel" });
    throw err;
  }
}
