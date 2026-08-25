import { NotFoundError } from "@/lib/errors";
import { mysql } from "@/lib/mysql/db";

import ApprovalReview from "../models/approval-review";
import type { ApprovalReviewAttrs } from "../models/approval-review";

export type UpsertReviewPayload = {
  approvalId: number;
  reviewerUserId: number;
  reviewer: string;
  attested: boolean;
  notes: string | null;
};

class ApprovalReviewCollection {
  /** All reviews for one approval, oldest first (reads as a thread). */
  static async listForApproval(approvalId: number): Promise<ApprovalReview[]> {
    const rows = await mysql<ApprovalReviewAttrs>`
      SELECT * FROM approval_reviews
      WHERE approval_id = ${approvalId}
      ORDER BY created_at ASC, id ASC
    `;
    return rows.map((row) => new ApprovalReview(row));
  }

  static async getById(id: number): Promise<ApprovalReview> {
    const rows = await mysql<ApprovalReviewAttrs>`
      SELECT * FROM approval_reviews WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundError("ApprovalReview", id);
    return new ApprovalReview(rows[0]);
  }

  static async findByReviewer(
    approvalId: number,
    reviewerUserId: number,
  ): Promise<ApprovalReview | null> {
    const rows = await mysql<ApprovalReviewAttrs>`
      SELECT * FROM approval_reviews
      WHERE approval_id = ${approvalId} AND reviewer_user_id = ${reviewerUserId}
      LIMIT 1
    `;
    return rows[0] ? new ApprovalReview(rows[0]) : null;
  }

  /**
   * Create or replace the reviewer's review. One row per (approval, reviewer)
   * is enforced by a unique key, so a second submit is an edit.
   */
  static async upsert(payload: UpsertReviewPayload): Promise<ApprovalReview> {
    await mysql`
      INSERT INTO approval_reviews
        (approval_id, reviewer_user_id, reviewer, attested, notes, created_at, updated_at)
      VALUES
        (${payload.approvalId}, ${payload.reviewerUserId}, ${payload.reviewer},
         ${payload.attested ? 1 : 0}, ${payload.notes}, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        reviewer = VALUES(reviewer),
        attested = VALUES(attested),
        notes = VALUES(notes),
        updated_at = NOW()
    `;
    const review = await this.findByReviewer(
      payload.approvalId,
      payload.reviewerUserId,
    );
    if (!review) throw new NotFoundError("ApprovalReview", payload.approvalId);
    return review;
  }

  static async delete(id: number): Promise<void> {
    await mysql`DELETE FROM approval_reviews WHERE id = ${id}`;
  }

  static async countForApproval(approvalId: number): Promise<number> {
    const rows = await mysql<{ n: number | string }>`
      SELECT COUNT(*) AS n FROM approval_reviews WHERE approval_id = ${approvalId}
    `;
    return Number(rows[0]?.n ?? 0);
  }
}

export default ApprovalReviewCollection;
