/**
 * One reviewer's sign-off on an approval (pre-release form).
 *
 * The "Reviewed" checkbox is stored as `reviewed_at` — the moment the
 * reviewer signed off. A row with notes but no timestamp is a comment, not a
 * sign-off, and doesn't count toward REQUIRED_REVIEWS (models/approval.ts).
 */

/**
 * Author-set kanban status for the review, independent of the reviewer's own
 * `attested` checkbox. Only the parent approval's author (or a dev) may
 * change it — see `assertCanModify` in controllers/approvals.ts.
 */
export const REVIEW_BOARD_STATUSES = [
  "not_started",
  "in_progress",
  "needs_changes",
  "reviewed",
] as const;
export type ReviewBoardStatus = (typeof REVIEW_BOARD_STATUSES)[number];

export const REVIEW_BOARD_STATUS_LABELS: Record<ReviewBoardStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  needs_changes: "Edits Requested",
  reviewed: "Review Complete",
};

export function isReviewBoardStatus(
  value: string,
): value is ReviewBoardStatus {
  return (REVIEW_BOARD_STATUSES as readonly string[]).includes(value);
}

export type ApprovalReviewAttrs = {
  id: number;
  approval_id: number;
  reviewer_user_id: number;
  reviewer: string;
  /**
   * Live-joined display name, aliased under a different name than `reviewer`
   * — reusing the `reviewer` alias for the computed column corrupts later
   * columns (seen: `board_status`/`created_at`/`updated_at` shifting into
   * the wrong field) under Bun's SQL driver. Only present on queries that
   * join `users`; falls back to the stored `reviewer` column otherwise.
   */
  reviewer_display?: string | null;
  attested: number | boolean;
  reviewed_at?: Date | string | null;
  notes?: string | null;
  board_status?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

/**
 * Guards against a corrupt/unparseable value producing an invalid Date that
 * would blow up later at `.toISOString()` — seen intermittently from the
 * pooled connection under concurrent queries.
 */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return isNaN(date.getTime()) ? null : date;
}

class ApprovalReview {
  readonly id: number;
  readonly approvalId: number;
  readonly reviewerUserId: number;
  /** Display name, joined live from users (email fallback) by the collection. */
  reviewer: string;
  reviewedAt: Date | null;
  notes: string | null;
  boardStatus: ReviewBoardStatus;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: ApprovalReviewAttrs) {
    this.id = attrs.id;
    this.approvalId = attrs.approval_id;
    this.reviewerUserId = attrs.reviewer_user_id;
    const reviewer = attrs.reviewer_display ?? attrs.reviewer;
    this.reviewer = typeof reviewer === "string" ? reviewer : String(reviewer);
    this.reviewedAt = toDate(attrs.reviewed_at);
    this.notes = attrs.notes ?? null;
    this.boardStatus = isReviewBoardStatus(attrs.board_status ?? "")
      ? (attrs.board_status as ReviewBoardStatus)
      : "not_started";
    this.createdAt = toDate(attrs.created_at);
    this.updatedAt = toDate(attrs.updated_at);
  }

  /** Signed off (the checkbox is checked). */
  get attested(): boolean {
    return this.reviewedAt !== null;
  }

  toJSON() {
    return {
      id: this.id,
      approvalId: this.approvalId,
      reviewerUserId: this.reviewerUserId,
      reviewer: this.reviewer,
      attested: this.attested,
      reviewedAt: this.reviewedAt?.toISOString() ?? null,
      notes: this.notes,
      boardStatus: this.boardStatus,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export type ApprovalReviewJSON = ReturnType<ApprovalReview["toJSON"]>;

export default ApprovalReview;
