"use client";

import type { ApprovalJSON } from "@catalog/models/approval";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";

import { ReviewKanbanBoard } from "./review-kanban-board";
import { formatReviewTimestamp, ReviewTable } from "./review-table";

/**
 * The review thread on a form's detail page plus, for eligible viewers, an
 * "Add review" form. Authors may review their own form — forms are often
 * filed on the author's behalf.
 */
export function ReviewPanel({
  approval,
  reviews,
  currentUserId,
  currentUserName,
  isAdmin,
  isDev,
}: {
  approval: ApprovalJSON;
  reviews: ApprovalReviewJSON[];
  currentUserId: number;
  currentUserName: string;
  isAdmin: boolean;
  isDev: boolean;
}) {
  const mine = reviews.some((r) => r.reviewerUserId === currentUserId);
  const isAuthor = approval.authorUserId === currentUserId;
  // Authors may review their own form — many are filed on their behalf.
  const canAdd = !mine;
  const canModify = isAuthor || isAdmin;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Review</h2>
        <p className="text-muted-foreground text-sm">
          {approval.reviewCount} of {approval.requiredReviews} required reviews
          {approval.isReviewed ? " — reviewed" : ""}
          {approval.releasedAt
            ? ` · released ${formatReviewTimestamp(approval.releasedAt)}`
            : ""}
        </p>
      </div>

      <ReviewKanbanBoard
        reviews={reviews}
        approvals={{ [approval.id]: approval }}
        canDrag={() => canModify}
        currentUserId={currentUserId}
        addReview={
          canAdd ? { approvalId: approval.id, currentUserName } : undefined
        }
      />

      {/* Temporarily hidden while iterating on the kanban board.
      <ReviewTable
        approvalId={approval.id}
        reviews={reviews}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        isDev={isDev}
        canAdd={canAdd}
      />
      */}
    </section>
  );
}
