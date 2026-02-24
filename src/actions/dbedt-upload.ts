"use server";

import { DbedtUploadCollection } from "@catalog/collections/universe-upload-collection";

import { requirePermission } from "@/lib/auth/permissions";

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
