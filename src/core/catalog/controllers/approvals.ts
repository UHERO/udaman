import {
  sendPreReleaseReviewed,
  sendPreReleaseSubmitted,
} from "@/core/mailers/pre-release-mailer";
import { resolvePreReleaseRecipients } from "@/core/mailers/recipients";
import { createLogger } from "@/core/observability/logger";
import { AuthorizationError } from "@/lib/errors";
import { mysql } from "@/lib/mysql/db";

import ApprovalCollection from "../collections/approval-collection";
import type {
  CreateApprovalPayload,
  UpdateApprovalPayload,
} from "../collections/approval-collection";
import ApprovalReviewCollection from "../collections/approval-review-collection";
import type Approval from "../models/approval";
import { REQUIRED_REVIEWS } from "../models/approval";
import type { ApprovalType } from "../models/approval";
import type { Universe } from "../types/shared";

const log = createLogger("catalog.approvals");

/*************************************************************************
 * APPROVALS Controller
 *************************************************************************/

/** Actor identity, used for the per-record ownership checks below. */
export type Actor = { userId: number; role: string };

function isAdmin(role: string): boolean {
  return role === "admin" || role === "dev";
}

/**
 * You may only modify an approval you authored.
 *
 * `enforceAccessPolicy` can only see the resource name, not the record, so the
 * ownership half of the rule has to live here. Admins are exempt so a stale or
 * mistaken submission can always be cleaned up.
 */
function assertCanModify(approval: Approval, actor: Actor): void {
  if (isAdmin(actor.role)) return;
  if (approval.authorUserId === actor.userId) return;
  throw new AuthorizationError(
    "You can only edit or delete approvals you submitted",
    { approvalId: approval.id, actorUserId: actor.userId },
  );
}

export async function getApprovals({
  universe,
  type,
  viewerUserId,
}: {
  universe: Universe;
  type?: ApprovalType;
  viewerUserId?: number;
}) {
  log.info({ universe, type }, "fetching approvals");
  const data = await ApprovalCollection.list({ universe, type, viewerUserId });
  log.info({ count: data.length }, "approvals fetched");
  return { data };
}

export async function getApproval({
  id,
  viewerUserId,
}: {
  id: number;
  viewerUserId?: number;
}) {
  log.info({ id }, "fetching approval");
  const data = await ApprovalCollection.getById(id, viewerUserId);
  return { data };
}

/*************************************************************************
 * Reviews
 *************************************************************************/

export async function getApprovalReviews({ id }: { id: number }) {
  const data = await ApprovalReviewCollection.listForApproval(id);
  return { data };
}

export async function getReviewsForApprovals({ ids }: { ids: number[] }) {
  const data = await ApprovalReviewCollection.listForApprovals(ids);
  return { data };
}

/**
 * Submit (or revise) the actor's review of an approval.
 *
 * Authors can't review their own form — the whole point of the count is
 * independent eyes. When this review is the one that crosses
 * REQUIRED_REVIEWS, the author is emailed once.
 */
export async function submitReview({
  id,
  actor,
  reviewerName,
  attested,
  notes,
  allowSelfReview = false,
}: {
  id: number;
  actor: Actor;
  reviewerName: string;
  attested: boolean;
  notes: string | null;
  /** See SELF_REVIEW_EXEMPT_EMAILS — resolved by the caller from the session. */
  allowSelfReview?: boolean;
}) {
  log.info({ id, reviewerUserId: actor.userId }, "submitting review");
  const approval = await ApprovalCollection.getById(id);
  if (approval.authorUserId === actor.userId && !allowSelfReview) {
    throw new AuthorizationError("You can't review your own pre-release form", {
      approvalId: id,
      actorUserId: actor.userId,
    });
  }
  const before = await ApprovalReviewCollection.countForApproval(id);
  const review = await ApprovalReviewCollection.upsert({
    approvalId: id,
    reviewerUserId: actor.userId,
    reviewer: reviewerName,
    attested,
    notes: notes?.trim() || null,
  });
  const after = await ApprovalReviewCollection.countForApproval(id);
  const isNew = after > before;
  log.info({ id, reviewId: review.id, count: after, isNew }, "review saved");

  if (isNew && before < REQUIRED_REVIEWS && after >= REQUIRED_REVIEWS) {
    notifyAuthorReviewed(approval.id, approval.authorUserId).catch((err) => {
      log.error(
        { err: err instanceof Error ? err.message : String(err), id },
        "reviewed notification failed",
      );
    });
  }

  return {
    message: isNew ? "Review saved" : "Review updated",
    data: review,
  };
}

async function notifyAuthorReviewed(approvalId: number, authorUserId: number) {
  const [approval, reviews, users] = await Promise.all([
    ApprovalCollection.getById(approvalId),
    ApprovalReviewCollection.listForApproval(approvalId),
    mysql<{
      email: string;
    }>`SELECT email FROM users WHERE id = ${authorUserId} LIMIT 1`,
  ]);
  const authorEmail = users[0]?.email;
  if (!authorEmail) {
    log.warn({ approvalId, authorUserId }, "author has no email; skipping");
    return;
  }
  await sendPreReleaseReviewed({
    approvalId,
    name: approval.name,
    authorEmail,
    reviewCount: reviews.length,
    reviews: reviews.map((r) => ({
      reviewer: r.reviewer,
      attested: r.attested,
      notes: r.notes,
    })),
  });
}

/** Only the reviewer themself, or a dev, may edit or withdraw a review. */
export function canManageReview(
  review: { reviewerUserId: number },
  actor: Actor,
): boolean {
  return actor.role === "dev" || review.reviewerUserId === actor.userId;
}

/** Remove a review. Reviewers may withdraw their own; devs may remove any. */
export async function deleteReview({
  reviewId,
  actor,
}: {
  reviewId: number;
  actor: Actor;
}) {
  const review = await ApprovalReviewCollection.getById(reviewId);
  if (!canManageReview(review, actor)) {
    throw new AuthorizationError("You can only withdraw your own review", {
      reviewId,
      actorUserId: actor.userId,
    });
  }
  await ApprovalReviewCollection.delete(reviewId);
  log.info({ reviewId, approvalId: review.approvalId }, "review deleted");
  return { message: "Review withdrawn", approvalId: review.approvalId };
}

/** Mark a form released (or un-mark it). Author or admin only. */
export async function setApprovalReleased({
  id,
  released,
  actor,
}: {
  id: number;
  released: boolean;
  actor: Actor;
}) {
  const existing = await ApprovalCollection.getById(id);
  assertCanModify(existing, actor);
  const data = await ApprovalCollection.setReleased(
    id,
    released ? { byUserId: actor.userId } : null,
  );
  log.info({ id, released }, "approval release mark updated");
  return {
    message: released ? "Marked as released" : "Release mark removed",
    data,
  };
}

export async function createApproval({
  payload,
}: {
  payload: CreateApprovalPayload;
}) {
  log.info({ name: payload.name }, "creating approval");

  // Record who we're about to notify, so the saved form is its own audit trail.
  const notifiedRecipients = resolvePreReleaseRecipients(payload.formData);
  const data = await ApprovalCollection.create({
    ...payload,
    formData: { ...payload.formData, notifiedRecipients },
  });
  log.info({ id: data.id }, "approval created");

  // Fire-and-forget: a mail failure must never lose a submitted form.
  sendPreReleaseSubmitted({
    approvalId: data.id,
    universe: data.universe,
    name: data.name,
    author: data.author,
    targetReleaseDate: data.toJSON().targetReleaseDate,
    submittedAt: data.createdAt ?? new Date(),
    formData: data.formData,
    recipients: notifiedRecipients,
  }).catch((err) => {
    log.error(
      { err: err instanceof Error ? err.message : String(err), id: data.id },
      "pre-release notification failed",
    );
  });

  return { message: "Pre-release form submitted", data };
}

/**
 * Re-send the submission notification for an existing form.
 *
 * Unlike the submit-time send, this is awaited so a transport failure reaches
 * the user who clicked resend. Recipients are re-resolved from the current
 * form data, and the audit trail is updated to reflect who was actually mailed.
 */
export async function resendApprovalNotification({
  id,
  actor,
}: {
  id: number;
  actor: Actor;
}) {
  log.info({ id }, "resending approval notification");
  const existing = await ApprovalCollection.getById(id);
  assertCanModify(existing, actor);

  const recipients = resolvePreReleaseRecipients(existing.formData);
  if (!recipients.length) {
    throw new Error(
      "This form has no recipients — edit it and add at least one address",
    );
  }

  await sendPreReleaseSubmitted({
    approvalId: existing.id,
    universe: existing.universe,
    name: existing.name,
    author: existing.author,
    targetReleaseDate: existing.toJSON().targetReleaseDate,
    submittedAt: existing.createdAt ?? new Date(),
    formData: existing.formData,
    recipients,
  });

  await ApprovalCollection.update(id, {
    formData: { ...existing.formData, notifiedRecipients: recipients },
  });

  log.info({ id, recipientCount: recipients.length }, "notification resent");
  return {
    message: `Notification sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`,
  };
}

export async function updateApproval({
  id,
  payload,
  actor,
}: {
  id: number;
  payload: UpdateApprovalPayload;
  actor: Actor;
}) {
  log.info({ id }, "updating approval");
  const existing = await ApprovalCollection.getById(id);
  assertCanModify(existing, actor);

  // Preserve the notification audit trail — editing doesn't re-send mail, so
  // rewriting notifiedRecipients from the new form would be a lie.
  const formData = payload.formData
    ? {
        ...payload.formData,
        notifiedRecipients: existing.formData.notifiedRecipients ?? [],
      }
    : undefined;

  const data = await ApprovalCollection.update(id, { ...payload, formData });
  log.info({ id }, "approval updated");
  return { message: "Pre-release form updated", data };
}

export async function deleteApproval({
  id,
  actor,
}: {
  id: number;
  actor: Actor;
}) {
  log.info({ id }, "deleting approval");
  const existing = await ApprovalCollection.getById(id);
  assertCanModify(existing, actor);

  await ApprovalCollection.delete(id);
  log.info({ id }, "approval deleted");
  return { message: "Pre-release form deleted" };
}
