"use server";

import { revalidatePath } from "next/cache";
import { AppLogCollection } from "@catalog/collections/app-log-collection";
import {
  createApproval as createApprovalCtrl,
  deleteApproval as deleteApprovalCtrl,
  getApproval as fetchApproval,
  getApprovals as fetchApprovals,
  updateApproval as updateApprovalCtrl,
} from "@catalog/controllers/approvals";
import type { PreReleaseFormData } from "@catalog/models/approval";
import type { Universe } from "@catalog/types/shared";

import { createLogger } from "@/core/observability/logger";
import { getSession } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/errors";

const log = createLogger("action.approvals");

/** Payload the pre-release form submits. Title/author/date are hoisted out of formData. */
export type PreReleaseSubmission = {
  name: string;
  targetReleaseDate: string | null;
  formData: PreReleaseFormData;
};

const REVALIDATE_PATH = "/comms/pub-form";

/**
 * Resolve the display name to store as `author`.
 *
 * Denormalized on purpose: users get renamed and deactivated, and a signed
 * certification shouldn't silently re-attribute itself when that happens.
 */
async function currentUserName(): Promise<string> {
  const session = await getSession();
  return session?.user?.name || session?.user?.email || "Unknown user";
}

export async function getApprovals() {
  const { universe } = await requirePermission("approval", "read");
  log.info({ universe }, "getApprovals action called");
  const result = await fetchApprovals({
    universe: universe as Universe,
    type: "pre_release",
  });
  log.info({ count: result.data.length }, "getApprovals action completed");
  return result.data.map((a) => a.toJSON());
}

export async function getApproval(id: number) {
  const { universe } = await requirePermission("approval", "read");
  log.info({ id }, "getApproval action called");
  const result = await fetchApproval({ id });
  // Approvals are scoped to the author's universe; don't leak one across.
  if (result.data.universe !== universe) {
    throw new NotFoundError("Approval", id);
  }
  return result.data.toJSON();
}

export async function createApproval(payload: PreReleaseSubmission) {
  const { userId, universe } = await requirePermission("approval", "create");
  log.info("createApproval action called");
  try {
    const result = await createApprovalCtrl({
      payload: {
        type: "pre_release",
        universe: universe as Universe,
        name: payload.name,
        author: await currentUserName(),
        authorUserId: userId,
        targetReleaseDate: payload.targetReleaseDate,
        formData: payload.formData,
      },
    });
    revalidatePath(REVALIDATE_PATH);
    log.info({ id: result.data.id }, "createApproval action completed");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createApproval failed");
    AppLogCollection.logError(err, { userId, name: "approval.create" });
    throw err;
  }
}

export async function updateApproval(
  id: number,
  payload: PreReleaseSubmission,
) {
  const { userId, role } = await requirePermission("approval", "update");
  log.info({ id }, "updateApproval action called");
  try {
    const result = await updateApprovalCtrl({
      id,
      payload: {
        name: payload.name,
        targetReleaseDate: payload.targetReleaseDate,
        formData: payload.formData,
      },
      actor: { userId, role },
    });
    revalidatePath(REVALIDATE_PATH);
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateApproval failed");
    AppLogCollection.logError(err, { userId, name: "approval.update" });
    throw err;
  }
}

export async function deleteApproval(id: number) {
  const { userId, role } = await requirePermission("approval", "delete");
  log.info({ id }, "deleteApproval action called");
  try {
    const result = await deleteApprovalCtrl({ id, actor: { userId, role } });
    revalidatePath(REVALIDATE_PATH);
    log.info({ id }, "deleteApproval action completed");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteApproval failed");
    AppLogCollection.logError(err, { userId, name: "approval.delete" });
    throw err;
  }
}
