"use server";

import { DvwUploadCollection } from "@catalog/collections/universe-upload-collection";

export async function getDvwUploadsAction() {
  const uploads = await DvwUploadCollection.list();
  return uploads.map((u) => u.toJSON());
}

export async function getDvwUploadStatusAction(id: number) {
  try {
    const upload = await DvwUploadCollection.getById(id);
    return upload.toJSON();
  } catch {
    return null;
  }
}
