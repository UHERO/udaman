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

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.source-details");

export async function getSourceDetails(params?: { universe?: Universe }) {
  await requirePermission("source-detail", "read");
  log.info({ universe: params?.universe }, "getSourceDetails action called");
  const result = await fetchSourceDetails({ u: params?.universe });
  log.info({ count: result.data.length }, "getSourceDetails action completed");
  return result.data.map((sd) => sd.toJSON());
}

export async function createSourceDetail(payload: CreateSourceDetailPayload) {
  const { userId } = await requirePermission("source-detail", "create");
  log.info("createSourceDetail action called");
  try {
    const result = await createSourceDetailCtrl({ payload });
    revalidatePath("/source-details");
    log.info({ id: result.data.id }, "createSourceDetail action completed");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createSourceDetail failed");
    AppLogCollection.logError(err, { userId, name: "source-detail.create" });
    throw err;
  }
}

export async function updateSourceDetail(
  id: number,
  payload: UpdateSourceDetailPayload,
) {
  const { userId } = await requirePermission("source-detail", "update");
  log.info({ id }, "updateSourceDetail action called");
  try {
    const result = await updateSourceDetailCtrl({ id, payload });
    revalidatePath("/source-details");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateSourceDetail failed");
    AppLogCollection.logError(err, { userId, name: "source-detail.update" });
    throw err;
  }
}

export async function deleteSourceDetail(id: number) {
  const { userId } = await requirePermission("source-detail", "delete");
  log.info({ id }, "deleteSourceDetail action called");
  try {
    const result = await deleteSourceDetailCtrl({ id });
    revalidatePath("/source-details");
    log.info({ id }, "deleteSourceDetail action completed");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteSourceDetail failed");
    AppLogCollection.logError(err, { userId, name: "source-detail.delete" });
    throw err;
  }
}
