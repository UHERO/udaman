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
  setReviewBoardStatus as setReviewBoardStatusCtrl,
  submitReview as submitReviewCtrl,
  updateApproval as updateApprovalCtrl,
} from "@catalog/controllers/approvals";
import type {
  ApprovalJSON,
  PreReleaseFormData,
} from "@catalog/models/approval";
import type ApprovalReviewModel from "@catalog/models/approval-review";
import type {
  ApprovalReviewJSON,
  ReviewBoardStatus,
} from "@catalog/models/approval-review";
import type { Universe } from "@catalog/types/shared";

import { createLogger } from "@/core/observability/logger";
import type { ActionResult } from "@/lib/action-result";
import { getSession } from "@/lib/auth/dal";
import {
  PermissionDeniedError,
  requirePermission,
} from "@/lib/auth/permissions";
import { normalizeUniverse } from "@/lib/auth/roles";
import {
  AuthorizationError,
  HttpError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { fuzzyScore } from "@/lib/fuzzy-match";
import { mysql } from "@/lib/mysql/db";

const log = createLogger("action.approvals");

/** Payload the pre-release form submits. Title/author/dates are hoisted out of formData. */
export type PreReleaseSubmission = {
  name: string;
  targetReleaseDate: string | null;
  reviewByDate: string | null;
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

type Saved<T> = ActionResult<{ message: string; data: T }>;

/**
 * The message to show for a failure the user caused and can act on (not
 * allowed, bad input, gone), or null for anything unexpected — which is
 * rethrown. See ActionResult for why these aren't simply thrown.
 */
function userFacingError(
  err: unknown,
): { ok: false; error: string; denied: boolean } | null {
  if (err instanceof PermissionDeniedError) {
    return {
      ok: false,
      error: "You don't have permission to do that.",
      denied: true,
    };
  }
  if (err instanceof HttpError && err.statusCode < 500) {
    return {
      ok: false,
      error: err.message,
      denied: err instanceof AuthorizationError,
    };
  }
  return null;
}

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

/** How many suggestions the recipient autocomplete shows. */
const RECIPIENT_SUGGESTION_LIMIT = 8;

/**
 * Recipient autocomplete: users in the submitter's universe, fuzzy-matched
 * on name, email, and id, best first. Same pool as listAuthorCandidates —
 * the users table is small enough to score in memory, which buys typo
 * tolerance that a LIKE query can't.
 */
export async function searchRecipientCandidates(
  query: string,
): Promise<AuthorCandidate[]> {
  const q = query.trim();
  if (!q) return [];
  const candidates = await listAuthorCandidates();
  return candidates
    .map((u) => ({ u, score: fuzzyScore(q, [u.name, u.email, u.id]) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RECIPIENT_SUGGESTION_LIMIT)
    .map((m) => m.u);
}

/**
 * Display names for recipient addresses, keyed by lowercased email. Addresses
 * with no account, or an account with no name, are simply absent.
 */
export async function lookupRecipientNames(
  emails: string[],
): Promise<Record<string, string>> {
  await requirePermission("approval", "read");
  const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()))]
    .filter(Boolean)
    .slice(0, 200);
  if (!wanted.length) return {};
  const rows = await mysql<{ name: string | null; email: string }>`
    SELECT name, email FROM users WHERE LOWER(email) IN ${mysql(wanted)}
  `;
  const names: Record<string, string> = {};
  for (const r of rows) {
    const name = r.name?.trim();
    if (name) names[r.email.toLowerCase()] = name;
  }
  return names;
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
    throw new ValidationError(
      "The selected author is not a user in this universe",
    );
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
): Promise<Saved<ApprovalReviewJSON>> {
  // Reviewing is a write, but any internal user may do it — same gate as
  // filing a form. Authors may review their own forms.
  const { userId, role } = await requirePermission("approval", "update");
  log.info({ id }, "submitReview action called");
  try {
    await getApproval(id); // universe scoping
    const result = await submitReviewCtrl({
      id,
      actor: { userId, role },
      reviewerName: await currentUserName(),
      attested: payload.attested,
      notes: payload.notes,
    });
    revalidatePath(REVALIDATE_PATH);
    revalidatePath(`/comms/pub-form/${id}`);
    return { ok: true, message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "submitReview failed");
    AppLogCollection.logError(err, { userId, name: "approval.review" });
    const failure = userFacingError(err);
    if (failure) return failure;
    throw err;
  }
}

export async function deleteReview(
  reviewId: number,
): Promise<ActionResult<{ message: string }>> {
  const { userId, role } = await requirePermission("approval", "update");
  log.info({ reviewId }, "deleteReview action called");
  try {
    const result = await deleteReviewCtrl({
      reviewId,
      actor: { userId, role },
    });
    revalidatePath(REVALIDATE_PATH);
    revalidatePath(`/comms/pub-form/${result.approvalId}`);
    return { ok: true, message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteReview failed");
    AppLogCollection.logError(err, { userId, name: "approval.review.delete" });
    const failure = userFacingError(err);
    if (failure) return failure;
    throw err;
  }
}

export async function setReviewBoardStatus(
  reviewId: number,
  status: ReviewBoardStatus,
): Promise<Saved<ApprovalReviewJSON>> {
  const { userId, role } = await requirePermission("approval", "update");
  log.info({ reviewId, status }, "setReviewBoardStatus action called");
  try {
    const result = await setReviewBoardStatusCtrl({
      reviewId,
      status,
      actor: { userId, role },
    });
    revalidatePath(REVALIDATE_PATH);
    revalidatePath(`/comms/pub-form/${result.approvalId}`);
    return { ok: true, message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "setReviewBoardStatus failed");
    AppLogCollection.logError(err, { userId, name: "approval.review.board" });
    const failure = userFacingError(err);
    if (failure) return failure;
    throw err;
  }
}

export async function setApprovalReleased(
  id: number,
  released: boolean,
): Promise<Saved<ApprovalJSON>> {
  const { userId, role } = await requirePermission("approval", "update");
  log.info({ id, released }, "setApprovalReleased action called");
  try {
    await getApproval(id); // universe scoping
    const result = await setApprovalReleasedCtrl({
      id,
      released,
      actor: { userId, role },
    });
    revalidatePath(REVALIDATE_PATH);
    revalidatePath(`/comms/pub-form/${id}`);
    return { ok: true, message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "setApprovalReleased failed");
    AppLogCollection.logError(err, { userId, name: "approval.release" });
    const failure = userFacingError(err);
    if (failure) return failure;
    throw err;
  }
}

export async function createApproval(
  payload: PreReleaseSubmission,
): Promise<Saved<ApprovalJSON>> {
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
        reviewByDate: payload.reviewByDate,
        formData: withAuthorRecipient(payload.formData, authorEmail),
      },
    });
    revalidatePath(REVALIDATE_PATH);
    log.info({ id: result.data.id }, "createApproval action completed");
    return { ok: true, message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createApproval failed");
    AppLogCollection.logError(err, { userId, name: "approval.create" });
    const failure = userFacingError(err);
    if (failure) return failure;
    throw err;
  }
}

export async function updateApproval(
  id: number,
  payload: PreReleaseSubmission,
): Promise<Saved<ApprovalJSON>> {
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
        reviewByDate: payload.reviewByDate,
        formData: withAuthorRecipient(payload.formData, authorEmail),
        ...author,
      },
      actor: { userId, role },
    });
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateApproval failed");
    AppLogCollection.logError(err, { userId, name: "approval.update" });
    const failure = userFacingError(err);
    if (failure) return failure;
    throw err;
  }
}

export async function resendApprovalNotification(
  id: number,
): Promise<ActionResult<{ message: string }>> {
  const { userId, role } = await requirePermission("approval", "update");
  log.info({ id }, "resendApprovalNotification action called");
  try {
    const result = await resendApprovalNotificationCtrl({
      id,
      actor: { userId, role },
    });
    log.info({ id }, "resendApprovalNotification action completed");
    return { ok: true, message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "resendApprovalNotification failed");
    AppLogCollection.logError(err, { userId, name: "approval.resend" });
    const failure = userFacingError(err);
    if (failure) return failure;
    throw err;
  }
}

export async function deleteApproval(
  id: number,
): Promise<ActionResult<{ message: string }>> {
  const { userId, role } = await requirePermission("approval", "delete");
  log.info({ id }, "deleteApproval action called");
  try {
    const result = await deleteApprovalCtrl({ id, actor: { userId, role } });
    revalidatePath(REVALIDATE_PATH);
    log.info({ id }, "deleteApproval action completed");
    return { ok: true, message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteApproval failed");
    AppLogCollection.logError(err, { userId, name: "approval.delete" });
    const failure = userFacingError(err);
    if (failure) return failure;
    throw err;
  }
}
