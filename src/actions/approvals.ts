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
import { normalizeUniverse } from "@/lib/auth/roles";
import { NotFoundError } from "@/lib/errors";
import { mysql } from "@/lib/mysql/db";

const log = createLogger("action.approvals");

/** Payload the pre-release form submits. Title/author/date are hoisted out of formData. */
export type PreReleaseSubmission = {
  name: string;
  targetReleaseDate: string | null;
  formData: PreReleaseFormData;
  /**
   * Lead author when the form is filed on someone else's behalf. Must be an
   * existing user in the submitter's universe; null/undefined means the
   * signed-in user is the author (create) or the author is unchanged (edit).
   */
  authorUserId?: number | null;
};

/** A user who can be named as lead author. Display name falls back to email. */
export type AuthorCandidate = {
  id: number;
  name: string | null;
  email: string;
};

const REVALIDATE_PATH = "/comms";

/**
 * Resolve the display name to store as `author` / `reviewer`.
 *
 * Read from the users table rather than the session: sessions are JWTs, so
 * a name set after login wouldn't show up until the next sign-in. Falls back
 * to the email when no name is set.
 *
 * Denormalized on purpose: users get renamed and deactivated, and a signed
 * certification shouldn't silently re-attribute itself when that happens.
 */
export async function currentUserName(): Promise<string> {
  const session = await getSession();
  const id = Number(session?.user?.id);
  if (id) {
    const rows = await mysql<{ name: string | null; email: string }>`
      SELECT name, email FROM users WHERE id = ${id} LIMIT 1
    `;
    const u = rows[0];
    if (u) return u.name?.trim() || u.email || "Unknown user";
  }
  return session?.user?.name || session?.user?.email || "Unknown user";
}

/**
 * Users who may be named as lead author on a pre-release form.
 *
 * Restricted to accounts in the submitter's universe (an approval is scoped
 * to it, and an author elsewhere could never open the form). DBEDT upload
 * accounts are excluded — they aren't people who write publications.
 */
export async function listAuthorCandidates(): Promise<AuthorCandidate[]> {
  const { universe } = await requirePermission("approval", "read");
  const rows = await mysql<AuthorCandidate>`
    SELECT id, name, email FROM users
    WHERE universe = ${normalizeUniverse(universe)}
      AND role != 'external'
    ORDER BY name ASC, email ASC
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email }));
}

type ResolvedAuthor = {
  author: string;
  authorUserId: number;
  /** Null only if the account somehow has no address. */
  authorEmail: string | null;
};

/**
 * Turn a requested author id into the `author` / `authorUserId` pair to store.
 *
 * No request (or a request for the submitter) attributes the form to the
 * signed-in user. Anyone else has to be a real account in this universe so
 * the stored name is the one on their user record, not free text.
 */
async function resolveAuthor(
  requestedId: number | null | undefined,
  submitterId: number,
  universe: string,
): Promise<ResolvedAuthor> {
  const id = requestedId || submitterId;
  const rows = await mysql<{
    name: string | null;
    email: string;
    universe: string | null;
  }>`
    SELECT name, email, universe FROM users WHERE id = ${id} LIMIT 1
  `;
  const u = rows[0];

  if (id === submitterId) {
    // Same fallbacks as currentUserName — the submitter is always a valid author.
    return {
      author: u
        ? u.name?.trim() || u.email || "Unknown user"
        : await currentUserName(),
      authorUserId: submitterId,
      authorEmail: u?.email ?? null,
    };
  }
  if (!u || normalizeUniverse(u.universe) !== normalizeUniverse(universe)) {
    throw new Error("The selected author is not a user in this universe");
  }
  return {
    author: u.name?.trim() || u.email || "Unknown user",
    authorUserId: id,
    authorEmail: u.email,
  };
}

/**
 * The lead author always gets the notification, whether or not the submitter
 * left them on the list. Forms are often filed on the author's behalf, and the
 * author is the one who most needs the copy.
 */
function withAuthorRecipient(
  formData: PreReleaseFormData,
  authorEmail: string | null,
): PreReleaseFormData {
  const email = authorEmail?.trim();
  if (!email) return formData;
  const recipients = formData.recipients ?? [];
  const present = recipients.some(
    (a) => a.trim().toLowerCase() === email.toLowerCase(),
  );
  return present
    ? formData
    : { ...formData, recipients: [...recipients, email] };
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
  // filing a form. Authors may review their own forms.
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
  log.info(
    { onBehalfOf: payload.authorUserId ?? null },
    "createApproval action called",
  );
  try {
    const { authorEmail, ...author } = await resolveAuthor(
      payload.authorUserId,
      userId,
      universe,
    );
    const result = await createApprovalCtrl({
      payload: {
        type: "pre_release",
        universe: universe as Universe,
        name: payload.name,
        ...author,
        targetReleaseDate: payload.targetReleaseDate,
        formData: withAuthorRecipient(payload.formData, authorEmail),
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
  const { userId, role, universe } = await requirePermission(
    "approval",
    "update",
  );
  log.info({ id }, "updateApproval action called");
  try {
    // Only re-attribute when the form explicitly asked to; a plain edit
    // leaves the author alone. A new author joins the recipient list so a
    // later resend reaches them.
    const { authorEmail, ...author } = payload.authorUserId
      ? await resolveAuthor(payload.authorUserId, userId, universe)
      : { authorEmail: null };
    const result = await updateApprovalCtrl({
      id,
      payload: {
        name: payload.name,
        targetReleaseDate: payload.targetReleaseDate,
        formData: withAuthorRecipient(payload.formData, authorEmail),
        ...author,
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
