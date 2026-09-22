"use client";

import { useState } from "react";
import type { ApprovalJSON } from "@catalog/models/approval";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";
import { Plus } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { NewReviewDialog, ReviewKanbanBoard } from "./review-kanban-board";

/**
 * Cross-comm kanban of only the current user's own reviews, across every
 * comm — a personal queue for reviewers tracking several ongoing reviews at
 * once. Co-reviewers' cards on the same forms are not shown here at all.
 *
 * Since this board mixes reviews from many approvals, "Add review" needs a
 * form picker first (unlike the single-approval board, which always knows
 * which approvalId a new card belongs to) — picking a form opens the same
 * detail-dialog layout used for viewing an existing card, just in create mode.
 */
export function ReviewerBoard({
  approvals,
  reviews,
  currentUserId,
  currentUserName,
}: {
  approvals: ApprovalJSON[];
  /** Reviews keyed by approval id. */
  reviews: Record<string, ApprovalReviewJSON[]>;
  currentUserId: number;
  currentUserName: string;
}) {
  const [creatingFor, setCreatingFor] = useState<ApprovalJSON | null>(null);

  const assigned = approvals.filter((a) =>
    (reviews[String(a.id)] ?? []).some(
      (r) => r.reviewerUserId === currentUserId,
    ),
  );
  const unreviewed = approvals.filter((a) => !a.reviewedByMe);
  const approvalsById = Object.fromEntries(assigned.map((a) => [a.id, a]));
  const cards = assigned
    .flatMap((a) => reviews[String(a.id)] ?? [])
    .filter((r) => r.reviewerUserId === currentUserId);

  return (
    <>
      <ReviewKanbanBoard
        reviews={cards}
        approvals={approvalsById}
        canDrag={(review) => review.reviewerUserId === currentUserId}
        currentUserId={currentUserId}
        showComm
        notStartedExtra={
          unreviewed.length > 0 ? (
            <AddReviewPicker
              key={creatingFor?.id ?? "none"}
              unreviewed={unreviewed}
              onPick={setCreatingFor}
            />
          ) : undefined
        }
      />
      {creatingFor && (
        <NewReviewDialog
          approval={creatingFor}
          currentUserName={currentUserName}
          onClose={() => setCreatingFor(null)}
        />
      )}
    </>
  );
}

/** Picks which not-yet-reviewed form to add a review for. */
function AddReviewPicker({
  unreviewed,
  onPick,
}: {
  unreviewed: ApprovalJSON[];
  onPick: (approval: ApprovalJSON) => void;
}) {
  return (
    <div className="flex w-full items-center gap-2">
      <Plus className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      <Select
        onValueChange={(value) => {
          const approval = unreviewed.find((a) => String(a.id) === value);
          if (approval) onPick(approval);
        }}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue placeholder="Add a review for…" />
        </SelectTrigger>
        <SelectContent>
          {unreviewed.map((a) => (
            <SelectItem key={a.id} value={String(a.id)}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
