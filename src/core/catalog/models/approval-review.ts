/**
 * One reviewer's sign-off on an approval (pre-release form).
 *
 * Primarily an attestation checkbox with optional notes. A form counts as
 * reviewed once it has REQUIRED_REVIEWS of these — see models/approval.ts.
 */

export type ApprovalReviewAttrs = {
  id: number;
  approval_id: number;
  reviewer_user_id: number;
  reviewer: string;
  attested: number | boolean;
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
  attested: boolean;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: ApprovalReviewAttrs) {
    this.id = attrs.id;
    this.approvalId = attrs.approval_id;
    this.reviewerUserId = attrs.reviewer_user_id;
    this.reviewer = attrs.reviewer;
    this.attested = Boolean(attrs.attested);
    this.notes = attrs.notes ?? null;
    this.createdAt = toDate(attrs.created_at);
    this.updatedAt = toDate(attrs.updated_at);
  }

  toJSON() {
    return {
      id: this.id,
      approvalId: this.approvalId,
      reviewerUserId: this.reviewerUserId,
      reviewer: this.reviewer,
      attested: this.attested,
      notes: this.notes,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export type ApprovalReviewJSON = ReturnType<ApprovalReview["toJSON"]>;

export default ApprovalReview;
