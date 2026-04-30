"use server";

import { DvwUploadCollection } from "@catalog/collections/universe-upload-collection";

import { requirePermission } from "@/lib/auth/permissions";

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
  await requirePermission("upload", "create");
  await DvwUploadCollection.updateStatus(id, "fail", "Cancelled by user");
}
