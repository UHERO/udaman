"use server";

import { revalidatePath } from "next/cache";
import { createLogger } from "@/core/observability/logger";
import {
  getSourceDetails as fetchSourceDetails,
  createSourceDetail as createSourceDetailCtrl,
  updateSourceDetail as updateSourceDetailCtrl,
  deleteSourceDetail as deleteSourceDetailCtrl,
} from "@catalog/controllers/source-details";
import type { CreateSourceDetailPayload, UpdateSourceDetailPayload } from "@catalog/collections/source-detail-collection";
import type { Universe } from "@catalog/types/shared";

const log = createLogger("action.source-details");

export async function getSourceDetails(params?: { universe?: Universe }) {
  log.info({ universe: params?.universe }, "getSourceDetails action called");
  const result = await fetchSourceDetails({ u: params?.universe });
  log.info({ count: result.data.length }, "getSourceDetails action completed");
  return result.data.map((sd) => sd.toJSON());
}

export async function createSourceDetail(payload: CreateSourceDetailPayload) {
  log.info("createSourceDetail action called");
  const result = await createSourceDetailCtrl({ payload });
  revalidatePath("/source-details");
  log.info({ id: result.data.id }, "createSourceDetail action completed");
  return result.data.toJSON();
}

export async function updateSourceDetail(id: number, payload: UpdateSourceDetailPayload) {
  log.info({ id }, "updateSourceDetail action called");
  const result = await updateSourceDetailCtrl({ id, payload });
  revalidatePath("/source-details");
  return result.data.toJSON();
}

export async function deleteSourceDetail(id: number): Promise<void> {
  log.info({ id }, "deleteSourceDetail action called");
  await deleteSourceDetailCtrl({ id });
  revalidatePath("/source-details");
  log.info({ id }, "deleteSourceDetail action completed");
}
