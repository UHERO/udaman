"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalJSON } from "@catalog/models/approval";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";
import { Check, Loader2, Rocket, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteReview,
  setApprovalReleased,
  submitReview,
} from "@/actions/approvals";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ATTESTATION =
  "I have read this pre-release form and the associated work product, and I have no unresolved concerns about its accuracy, disclosures, or compliance.";

function formatTimestamp(value: string | null): string {
  if (!value) return "";
  return `${new Date(value).toLocaleString("en-US", {
    timeZone: "Pacific/Honolulu",
    dateStyle: "medium",
    timeStyle: "short",
  })} HST`;
}

/**
 * The review thread on a form plus, for eligible viewers, the attestation
 * form. Authors see the thread and the release toggle but cannot review.
 */
export function ReviewPanel({
  approval,
  reviews,
  currentUserId,
  isAdmin,
}: {
  approval: ApprovalJSON;
  reviews: ApprovalReviewJSON[];
  currentUserId: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const mine = reviews.find((r) => r.reviewerUserId === currentUserId) ?? null;
  const isAuthor = approval.authorUserId === currentUserId;
  const canRelease = isAuthor || isAdmin;

  const [editing, setEditing] = useState(false);
  const [attested, setAttested] = useState(mine?.attested ?? false);
  const [notes, setNotes] = useState(mine?.notes ?? "");

  const showForm = !isAuthor && (!mine || editing);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await submitReview(approval.id, { attested, notes });
        toast.success(result.message);
        setEditing(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Review failed");
      }
    });
  }

  function handleDelete(reviewId: number) {
    startTransition(async () => {
      try {
        const result = await deleteReview(reviewId);
        toast.success(result.message);
        setAttested(false);
        setNotes("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not withdraw");
      }
    });
  }

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
              ? ` · released ${formatTimestamp(approval.releasedAt)}`
              : ""}
          </p>
        </div>
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

      {reviews.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {reviews.map((r) => {
            const own = r.reviewerUserId === currentUserId;
            return (
              <li key={r.id} className="flex gap-3 p-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-medium">
                      {r.reviewer}
                      {own && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          (you)
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatTimestamp(r.updatedAt ?? r.createdAt)}
                      {r.updatedAt && r.createdAt && r.updatedAt !== r.createdAt
                        ? " · edited"
                        : ""}
                    </span>
                  </div>
                  {r.notes ? (
                    <p className="text-sm whitespace-pre-wrap">{r.notes}</p>
                  ) : (
                    <p className="text-muted-foreground text-sm">No notes.</p>
                  )}
                  {(own || isAdmin) && !editing && (
                    <div className="flex gap-1 pt-1">
                      {own && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 cursor-pointer px-2 text-xs"
                          onClick={() => {
                            setAttested(r.attested);
                            setNotes(r.notes ?? "");
                            setEditing(true);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-7 cursor-pointer px-2 text-xs"
                        disabled={isPending}
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Withdraw
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No reviews yet.</p>
      )}

      {isAuthor && (
        <p className="text-muted-foreground text-sm">
          As the lead author you can&rsquo;t review your own form.
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-md border p-4"
        >
          <div className="text-sm font-medium">
            {mine ? "Edit your review" : "Add your review"}
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="review-attested"
              checked={attested}
              onCheckedChange={(v) => setAttested(v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="review-attested"
              className="text-sm leading-snug font-normal"
            >
              {ATTESTATION}
            </Label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="review-notes">Notes (optional)</Label>
            <Textarea
              id="review-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the author should know — concerns, suggested edits, context."
              className="field-sizing-content min-h-20 resize-y"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={isPending || !attested}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mine ? "Save review" : "Submit review"}
            </Button>
            {mine && (
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer"
                disabled={isPending}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
