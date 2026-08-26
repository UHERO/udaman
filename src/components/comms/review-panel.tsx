"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalJSON } from "@catalog/models/approval";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";
import { Rocket, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { setApprovalReleased } from "@/actions/approvals";
import { Button } from "@/components/ui/button";

import { formatReviewTimestamp, ReviewTable } from "./review-table";

/**
 * The review thread on a form's detail page plus, for eligible viewers, an
 * "Add review" form. Authors see the thread and the release toggle but
 * cannot review.
 */
export function ReviewPanel({
  approval,
  reviews,
  currentUserId,
  currentUserName,
  isAdmin,
  isDev,
  canSelfReview = false,
}: {
  approval: ApprovalJSON;
  reviews: ApprovalReviewJSON[];
  currentUserId: number;
  currentUserName: string;
  isAdmin: boolean;
  isDev: boolean;
  /** Author may review their own form (developer testing exemption). */
  canSelfReview?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const mine = reviews.some((r) => r.reviewerUserId === currentUserId);
  const isAuthor = approval.authorUserId === currentUserId;
  const canRelease = isAuthor || isAdmin;
  const canAdd = (canSelfReview || !isAuthor) && !mine;

  function handleRelease(released: boolean) {
    startTransition(async () => {
      try {
        const result = await setApprovalReleased(approval.id, released);
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Review</h2>
          <p className="text-muted-foreground text-sm">
            {approval.reviewCount} of {approval.requiredReviews} required
            reviews
            {approval.isReviewed ? " — reviewed" : ""}
            {approval.releasedAt
              ? ` · released ${formatReviewTimestamp(approval.releasedAt)}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {canRelease && (
            <Button
              type="button"
              variant={approval.isReleased ? "outline" : "default"}
              className="cursor-pointer"
              disabled={isPending}
              onClick={() => handleRelease(!approval.isReleased)}
            >
              {approval.isReleased ? (
                <>
                  <Undo2 className="h-4 w-4" />
                  Undo release
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Mark released
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <ReviewTable
        approvalId={approval.id}
        reviews={reviews}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        isDev={isDev}
        canAdd={canAdd}
      />

      {isAuthor && !canSelfReview && (
        <p className="text-muted-foreground text-sm">
          As the lead author you can&rsquo;t review your own form.
        </p>
      )}
    </section>
  );
}
