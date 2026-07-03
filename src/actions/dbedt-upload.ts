"use server";

import { DbedtUploadCollection } from "@catalog/collections/universe-upload-collection";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.dbedt-upload");

export async function getDbedtUploadsAction() {
  await requirePermission("upload", "read");
  const uploads = await DbedtUploadCollection.list();
  return uploads.map((u) => u.toJSON());
}

export async function getDbedtUploadStatusAction(id: number) {
  await requirePermission("upload", "read");
  try {
    const upload = await DbedtUploadCollection.getById(id);
    return upload.toJSON();
  } catch {
    return null;
  }
}

export async function cancelDbedtUploadAction(id: number) {
  const { userId } = await requirePermission("upload", "create");
  log.info({ id }, "cancelDbedtUploadAction called");
  try {
    await DbedtUploadCollection.updateStatus(id, "fail", "Cancelled by user");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "cancelDbedtUploadAction failed");
    AppLogCollection.logError(err, { userId, name: "dbedt-upload.cancel" });
    throw err;
  }
}
