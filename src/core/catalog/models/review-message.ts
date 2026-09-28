/**
 * One message in a review's clarification thread.
 *
 * Distinct from the `messages` audit table (every outbound email/slack/sms
 * ever sent) — this is the conversational record attached to a single
 * approval review, shown in the kanban card's detail modal. Sending a
 * message to the reviewer also emails them; `emailedAt` records that it went
 * out (null for a message the send failed for, so it still shows in-thread).
 */

export type ReviewMessageAttrs = {
  id: number;
  approval_review_id: number;
  sender_user_id: number;
  sender: string;
  body: string;
  emailed_at?: Date | string | null;
  created_at?: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return isNaN(date.getTime()) ? null : date;
}

class ReviewMessage {
  readonly id: number;
  readonly approvalReviewId: number;
  readonly senderUserId: number;
  readonly sender: string;
  readonly body: string;
  readonly emailedAt: Date | null;
  readonly createdAt: Date | null;

  constructor(attrs: ReviewMessageAttrs) {
    this.id = attrs.id;
    this.approvalReviewId = attrs.approval_review_id;
    this.senderUserId = attrs.sender_user_id;
    this.sender = attrs.sender;
    this.body = attrs.body;
    this.emailedAt = toDate(attrs.emailed_at);
    this.createdAt = toDate(attrs.created_at);
  }

  toJSON() {
    return {
      id: this.id,
      approvalReviewId: this.approvalReviewId,
      senderUserId: this.senderUserId,
      sender: this.sender,
      body: this.body,
      emailed: this.emailedAt !== null,
      createdAt: this.createdAt?.toISOString() ?? null,
    };
  }
}

export type ReviewMessageJSON = ReturnType<ReviewMessage["toJSON"]>;

export default ReviewMessage;
