import "server-only";

import { sendPreReleaseSubmitted } from "@/core/mailers/pre-release-mailer";
import { PRE_RELEASE_RECIPIENTS } from "@/core/mailers/recipients";
import { createLogger } from "@/core/observability/logger";
import { AuthorizationError } from "@/lib/errors";

import ApprovalCollection from "../collections/approval-collection";
import type {
  CreateApprovalPayload,
  UpdateApprovalPayload,
} from "../collections/approval-collection";
import type Approval from "../models/approval";
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
}: {
  universe: Universe;
  type?: ApprovalType;
}) {
  log.info({ universe, type }, "fetching approvals");
  const data = await ApprovalCollection.list({ universe, type });
  log.info({ count: data.length }, "approvals fetched");
  return { data };
}

export async function getApproval({ id }: { id: number }) {
  log.info({ id }, "fetching approval");
  const data = await ApprovalCollection.getById(id);
  return { data };
}

export async function createApproval({
  payload,
}: {
  payload: CreateApprovalPayload;
}) {
  log.info({ name: payload.name }, "creating approval");

  // Record who we're about to notify, so the saved form is its own audit trail.
  const notifiedRecipients = [
    ...PRE_RELEASE_RECIPIENTS,
    ...(payload.formData.additionalRecipients ?? []),
  ];
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
    additionalRecipients: data.formData.additionalRecipients,
  }).catch((err) => {
    log.error(
      { err: err instanceof Error ? err.message : String(err), id: data.id },
      "pre-release notification failed",
    );
  });

  return { message: "Pre-release form submitted", data };
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
