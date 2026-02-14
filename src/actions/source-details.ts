"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateSourceDetailPayload,
  UpdateSourceDetailPayload,
} from "@catalog/collections/source-detail-collection";
import {
  createSourceDetail as createSourceDetailCtrl,
  deleteSourceDetail as deleteSourceDetailCtrl,
  getSourceDetails as fetchSourceDetails,
  updateSourceDetail as updateSourceDetailCtrl,
} from "@catalog/controllers/source-details";
import type { Universe } from "@catalog/types/shared";

import { createLogger } from "@/core/observability/logger";

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
  return { message: result.message, data: result.data.toJSON() };
}

export async function updateSourceDetail(
  id: number,
  payload: UpdateSourceDetailPayload,
) {
  log.info({ id }, "updateSourceDetail action called");
  const result = await updateSourceDetailCtrl({ id, payload });
  revalidatePath("/source-details");
  return { message: result.message, data: result.data.toJSON() };
}

export async function deleteSourceDetail(id: number) {
  log.info({ id }, "deleteSourceDetail action called");
  const result = await deleteSourceDetailCtrl({ id });
  revalidatePath("/source-details");
  log.info({ id }, "deleteSourceDetail action completed");
  return { message: result.message };
}
