/**
 * One reviewer's sign-off on an approval (pre-release form).
 *
 * The "Reviewed" checkbox is stored as `reviewed_at` — the moment the
 * reviewer signed off. A row with notes but no timestamp is a comment, not a
 * sign-off, and doesn't count toward REQUIRED_REVIEWS (models/approval.ts).
 */

export type ApprovalReviewAttrs = {
  id: number;
  approval_id: number;
  reviewer_user_id: number;
  reviewer: string;
  attested: number | boolean;
  reviewed_at?: Date | string | null;
  notes?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  return value ? new Date(value as string | Date) : null;
}

class ApprovalReview {
  readonly id: number;
  readonly approvalId: number;
  readonly reviewerUserId: number;
  reviewer: string;
  reviewedAt: Date | null;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: ApprovalReviewAttrs) {
    this.id = attrs.id;
    this.approvalId = attrs.approval_id;
    this.reviewerUserId = attrs.reviewer_user_id;
    this.reviewer = attrs.reviewer;
    this.reviewedAt = toDate(attrs.reviewed_at);
    this.notes = attrs.notes ?? null;
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
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export type ApprovalReviewJSON = ReturnType<ApprovalReview["toJSON"]>;

export default ApprovalReview;
