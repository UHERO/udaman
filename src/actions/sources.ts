"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateSourcePayload,
  UpdateSourcePayload,
} from "@catalog/collections/source-collection";
import {
  createSource as createSourceCtrl,
  deleteSource as deleteSourceCtrl,
  getSources as fetchSources,
  updateSource as updateSourceCtrl,
} from "@catalog/controllers/sources";
import type { Universe } from "@catalog/types/shared";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.sources");

export async function getSources(params?: { universe?: Universe }) {
  await requirePermission("source", "read");
  log.info({ universe: params?.universe }, "getSources action called");
  const result = await fetchSources({ u: params?.universe });
  log.info({ count: result.data.length }, "getSources action completed");
  return result.data.map((s) => s.toJSON());
}

export async function createSource(payload: CreateSourcePayload) {
  const { userId } = await requirePermission("source", "create");
  log.info("createSource action called");
  try {
    const result = await createSourceCtrl({ payload });
    revalidatePath("/sources");
    log.info({ id: result.data.id }, "createSource action completed");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createSource failed");
    AppLogCollection.logError(err, { userId, name: "source.create" });
    throw err;
  }
}

export async function updateSource(id: number, payload: UpdateSourcePayload) {
  const { userId } = await requirePermission("source", "update");
  log.info({ id }, "updateSource action called");
  try {
    const result = await updateSourceCtrl({ id, payload });
    revalidatePath("/sources");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateSource failed");
    AppLogCollection.logError(err, { userId, name: "source.update" });
    throw err;
  }
}

export async function deleteSource(id: number) {
  const { userId } = await requirePermission("source", "delete");
  log.info({ id }, "deleteSource action called");
  try {
    const result = await deleteSourceCtrl({ id });
    revalidatePath("/sources");
    log.info({ id }, "deleteSource action completed");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteSource failed");
    AppLogCollection.logError(err, { userId, name: "source.delete" });
    throw err;
  }
}
