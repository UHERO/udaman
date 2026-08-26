"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalJSON } from "@catalog/models/approval";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";
import { Plus, Rocket, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { setApprovalReleased } from "@/actions/approvals";
import { Button } from "@/components/ui/button";

import { formatReviewTimestamp, ReviewForm } from "./review-form";

/**
 * The review thread on a form's detail page plus, for eligible viewers, an
 * "Add review" form. Authors see the thread and the release toggle but
 * cannot review.
 */
export function ReviewPanel({
  approval,
  reviews,
  currentUserId,
  isAdmin,
  isDev,
}: {
  approval: ApprovalJSON;
  reviews: ApprovalReviewJSON[];
  currentUserId: number;
  isAdmin: boolean;
  isDev: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const mine = reviews.some((r) => r.reviewerUserId === currentUserId);
  const isAuthor = approval.authorUserId === currentUserId;
  const canRelease = isAuthor || isAdmin;
  const canAdd = !isAuthor && !mine;

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
          {canAdd && !adding && (
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-4 w-4" />
              Add review
            </Button>
          )}
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

      {reviews.length > 0 || adding ? (
        <div className="divide-y rounded-md border">
          {reviews.map((r) => (
            <ReviewForm
              key={r.id}
              approvalId={approval.id}
              review={r}
              currentUserId={currentUserId}
              isDev={isDev}
              className="p-3"
            />
          ))}
          {adding && (
            <ReviewForm
              approvalId={approval.id}
              currentUserId={currentUserId}
              isDev={isDev}
              onDone={() => setAdding(false)}
              className="bg-muted/30 p-3"
            />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No reviews yet.</p>
      )}

      {isAuthor && (
        <p className="text-muted-foreground text-sm">
          As the lead author you can&rsquo;t review your own form.
        </p>
      )}
    </section>
  );
}
