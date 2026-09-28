"use client";

import type { ApprovalJSON } from "@catalog/models/approval";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";

import { ReviewKanbanBoard } from "./review-kanban-board";

/**
 * Cross-comm kanban: every review across every comm the current user
 * authored, so they can track reviewer progress without opening each one.
 * The author drags cards here the same as the per-comm mini-board.
 */
export function AuthorReviewBoard({
  approvals,
  reviews,
  currentUserId,
}: {
  approvals: ApprovalJSON[];
  /** Reviews keyed by approval id. */
  reviews: Record<string, ApprovalReviewJSON[]>;
  currentUserId: number;
}) {
  const authored = approvals.filter((a) => a.authorUserId === currentUserId);
  const approvalsById = Object.fromEntries(authored.map((a) => [a.id, a]));
  const cards = authored.flatMap((a) => reviews[String(a.id)] ?? []);

  if (!authored.length) {
    return (
      <p className="text-muted-foreground py-8 text-sm">
        You haven&rsquo;t authored any pre-release forms yet.
      </p>
    );
  }

  return (
    <ReviewKanbanBoard
      reviews={cards}
      approvals={approvalsById}
      canDrag={() => true}
      currentUserId={currentUserId}
      showComm
    />
  );
}
