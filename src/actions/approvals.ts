"use server";

import { revalidatePath } from "next/cache";
import { AppLogCollection } from "@catalog/collections/app-log-collection";
import {
  createApproval as createApprovalCtrl,
  deleteApproval as deleteApprovalCtrl,
  deleteReview as deleteReviewCtrl,
  getApproval as fetchApproval,
  getApprovalReviews as fetchApprovalReviews,
  getApprovals as fetchApprovals,
  getReviewsForApprovals as fetchReviewsForApprovals,
  resendApprovalNotification as resendApprovalNotificationCtrl,
  setApprovalReleased as setApprovalReleasedCtrl,
  submitReview as submitReviewCtrl,
  updateApproval as updateApprovalCtrl,
} from "@catalog/controllers/approvals";
import type { PreReleaseFormData } from "@catalog/models/approval";
import type ApprovalReviewModel from "@catalog/models/approval-review";
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

const REVALIDATE_PATH = "/comms";

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
  const { universe, userId } = await requirePermission("approval", "read");
  log.info({ universe }, "getApprovals action called");
  const result = await fetchApprovals({
    universe: universe as Universe,
    type: "pre_release",
    viewerUserId: userId,
  });
  log.info({ count: result.data.length }, "getApprovals action completed");
  return result.data.map((a) => a.toJSON());
}

export async function getApproval(id: number) {
  const { universe, userId } = await requirePermission("approval", "read");
  log.info({ id }, "getApproval action called");
  const result = await fetchApproval({ id, viewerUserId: userId });
  // Approvals are scoped to the author's universe; don't leak one across.
  if (result.data.universe !== universe) {
    throw new NotFoundError("Approval", id);
  }
  return result.data.toJSON();
}

/**
 * Approvals plus every review on them, for the expandable list. Reviews are
 * keyed by approval id (as strings — Map doesn't survive the RSC boundary).
 */
export async function getApprovalsWithReviews() {
  const approvals = await getApprovals();
  const result = await fetchReviewsForApprovals({
    ids: approvals.map((a) => a.id),
  });
  const reviews: Record<string, ReturnType<ApprovalReviewModel["toJSON"]>[]> =
    {};
  for (const [id, list] of result.data) {
    reviews[String(id)] = list.map((r) => r.toJSON());
  }
  return { approvals, reviews };
}

export async function getApprovalReviews(id: number) {
  await getApproval(id); // permission + universe scoping
  const result = await fetchApprovalReviews({ id });
  return result.data.map((r) => r.toJSON());
}

export async function submitReview(
  id: number,
  payload: { attested: boolean; notes: string },
) {
  // Reviewing is a write, but any internal user may do it — same gate as
  // filing a form. Author-can't-self-review lives in the controller.
  const { userId, role } = await requirePermission("approval", "update");
  await getApproval(id); // universe scoping
  log.info({ id }, "submitReview action called");
  try {
    const result = await submitReviewCtrl({
      id,
      actor: { userId, role },
      reviewerName: await currentUserName(),
      attested: payload.attested,
      notes: payload.notes,
    });
    revalidatePath(REVALIDATE_PATH);
    revalidatePath(`/comms/pub-form/${id}`);
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "submitReview failed");
    AppLogCollection.logError(err, { userId, name: "approval.review" });
    throw err;
  }
}

export async function deleteReview(reviewId: number) {
  const { userId, role } = await requirePermission("approval", "update");
  log.info({ reviewId }, "deleteReview action called");
  try {
    const result = await deleteReviewCtrl({
      reviewId,
      actor: { userId, role },
    });
    revalidatePath(REVALIDATE_PATH);
    revalidatePath(`/comms/pub-form/${result.approvalId}`);
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteReview failed");
    AppLogCollection.logError(err, { userId, name: "approval.review.delete" });
    throw err;
  }
}

export async function setApprovalReleased(id: number, released: boolean) {
  const { userId, role } = await requirePermission("approval", "update");
  await getApproval(id); // universe scoping
  log.info({ id, released }, "setApprovalReleased action called");
  try {
    const result = await setApprovalReleasedCtrl({
      id,
      released,
      actor: { userId, role },
    });
    revalidatePath(REVALIDATE_PATH);
    revalidatePath(`/comms/pub-form/${id}`);
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "setApprovalReleased failed");
    AppLogCollection.logError(err, { userId, name: "approval.release" });
    throw err;
  }
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

export async function resendApprovalNotification(id: number) {
  const { userId, role } = await requirePermission("approval", "update");
  log.info({ id }, "resendApprovalNotification action called");
  try {
    const result = await resendApprovalNotificationCtrl({
      id,
      actor: { userId, role },
    });
    log.info({ id }, "resendApprovalNotification action completed");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "resendApprovalNotification failed");
    AppLogCollection.logError(err, { userId, name: "approval.resend" });
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
