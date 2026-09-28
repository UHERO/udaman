import { mysql } from "@/lib/mysql/db";

import ReviewMessage from "../models/review-message";
import type { ReviewMessageAttrs } from "../models/review-message";

export type CreateReviewMessagePayload = {
  approvalReviewId: number;
  senderUserId: number;
  sender: string;
  body: string;
};

class ReviewMessageCollection {
  /** Full thread for one review, oldest first. */
  static async listForReview(
    approvalReviewId: number,
  ): Promise<ReviewMessage[]> {
    const rows = await mysql<ReviewMessageAttrs>`
      SELECT * FROM review_messages
      WHERE approval_review_id = ${approvalReviewId}
      ORDER BY created_at ASC, id ASC
    `;
    return rows.map((row) => new ReviewMessage(row));
  }

  static async create(
    payload: CreateReviewMessagePayload,
  ): Promise<ReviewMessage> {
    await mysql`
      INSERT INTO review_messages
        (approval_review_id, sender_user_id, sender, body, created_at)
      VALUES
        (${payload.approvalReviewId}, ${payload.senderUserId}, ${payload.sender}, ${payload.body}, NOW())
    `;
    const rows = await mysql<ReviewMessageAttrs>`
      SELECT * FROM review_messages WHERE id = LAST_INSERT_ID()
    `;
    return new ReviewMessage(rows[0]);
  }

  /** Record that a message's email notification went out. */
  static async markEmailed(id: number): Promise<void> {
    await mysql`
      UPDATE review_messages SET emailed_at = NOW() WHERE id = ${id}
    `;
  }
}

export default ReviewMessageCollection;
