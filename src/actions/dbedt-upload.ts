"use server";

import { DbedtUploadCollection } from "@catalog/collections/universe-upload-collection";

export async function getDbedtUploadsAction() {
  const uploads = await DbedtUploadCollection.list();
  return uploads.map((u) => u.toJSON());
}

export async function getDbedtUploadStatusAction(id: number) {
  try {
    const upload = await DbedtUploadCollection.getById(id);
    return upload.toJSON();
  } catch {
    return null;
  }
}
