"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateApiApplicationPayload,
  UpdateApiApplicationPayload,
} from "@catalog/collections/api-application-collection";
import {
  createApiApplication as createCtrl,
  deleteApiApplication as deleteCtrl,
  getApiApplications as fetchCtrl,
  updateApiApplication as updateCtrl,
} from "@catalog/controllers/api-applications";

import { createLogger } from "@/core/observability/logger";
import { getCurrentUserRole } from "@/lib/auth/dal";
import { AuthorizationError } from "@/lib/errors";

const log = createLogger("action.api-applications");

async function requireDev() {
  const role = await getCurrentUserRole();
  if (role !== "dev")
    throw new AuthorizationError("Unauthorized: dev role required");
}

export async function listApiApplications() {
  await requireDev();
  log.info("listApiApplications action called");
  const result = await fetchCtrl();
  return result.data.map((a) => a.toJSON());
}

export async function createApiApplicationAction(
  payload: CreateApiApplicationPayload,
): Promise<{ success: boolean; message: string }> {
  await requireDev();
  try {
    log.info("createApiApplicationAction called");
    const result = await createCtrl({ payload });
    revalidatePath("/admin/api-keys");
    log.info({ id: result.data.id }, "createApiApplicationAction completed");
    return { success: true, message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "createApiApplicationAction failed");
    return { success: false, message: `Failed to create API key: ${message}` };
  }
}

export async function updateApiApplicationAction(
  id: number,
  payload: UpdateApiApplicationPayload,
): Promise<{ success: boolean; message: string }> {
  await requireDev();
  try {
    log.info({ id }, "updateApiApplicationAction called");
    const result = await updateCtrl({ id, payload });
    revalidatePath("/admin/api-keys");
    return { success: true, message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "updateApiApplicationAction failed");
    return { success: false, message: `Failed to update API key: ${message}` };
  }
}

export async function deleteApiApplicationAction(
  id: number,
): Promise<{ success: boolean; message: string }> {
  await requireDev();
  try {
    log.info({ id }, "deleteApiApplicationAction called");
    const result = await deleteCtrl({ id });
    revalidatePath("/admin/api-keys");
    return { success: true, message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "deleteApiApplicationAction failed");
    return { success: false, message: `Failed to delete API key: ${message}` };
  }
}
