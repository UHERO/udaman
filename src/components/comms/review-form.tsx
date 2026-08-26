"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteReview, submitReview } from "@/actions/approvals";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const REVIEW_ATTESTATION =
  "I have read this pre-release form and the associated work product, and I have no unresolved concerns about its accuracy, disclosures, or compliance.";

export function formatReviewTimestamp(value: string | null): string {
  if (!value) return "";
  return `${new Date(value).toLocaleString("en-US", {
    timeZone: "Pacific/Honolulu",
    dateStyle: "medium",
    timeStyle: "short",
  })} HST`;
}

/**
 * One review as an inline form.
 *
 * An existing review renders with its inputs disabled; "Edit" enables them.
 * With no `review`, it's a blank, enabled form for adding one. Editing and
 * withdrawing are limited to the reviewer themself and dev users — the
 * server enforces the same rule.
 */
export function ReviewForm({
  approvalId,
  review,
  currentUserId,
  isDev,
  onDone,
  className,
}: {
  approvalId: number;
  review?: ApprovalReviewJSON | null;
  currentUserId: number;
  isDev: boolean;
  /** Called after a successful save/withdraw or a cancel of a new form. */
  onDone?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isNew = !review;
  const [editing, setEditing] = useState(isNew);
  const [attested, setAttested] = useState(review?.attested ?? false);
  const [notes, setNotes] = useState(review?.notes ?? "");

  const own = review?.reviewerUserId === currentUserId;
  const canManage = isNew || own || isDev;
  const enabled = editing && canManage;
  const uid = `review-${approvalId}-${review?.id ?? "new"}`;

  function reset() {
    setAttested(review?.attested ?? false);
    setNotes(review?.notes ?? "");
    setEditing(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await submitReview(approvalId, { attested, notes });
        toast.success(result.message);
        setEditing(false);
        onDone?.();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Review failed");
      }
    });
  }

  function handleDelete() {
    if (!review) return;
    startTransition(async () => {
      try {
        const result = await deleteReview(review.id);
        toast.success(result.message);
        onDone?.();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not withdraw");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-3", className)}
      aria-label={isNew ? "Add review" : `Review by ${review.reviewer}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">
          {isNew ? "Your review" : review.reviewer}
          {own && !isNew && (
            <span className="text-muted-foreground font-normal"> (you)</span>
          )}
        </span>
        {!isNew && (
          <span className="text-muted-foreground text-xs">
            {formatReviewTimestamp(review.updatedAt ?? review.createdAt)}
            {review.updatedAt &&
            review.createdAt &&
            review.updatedAt !== review.createdAt
              ? " · edited"
              : ""}
          </span>
        )}
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id={`${uid}-attested`}
          checked={attested}
          disabled={!enabled}
          onCheckedChange={(v) => setAttested(v === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor={`${uid}-attested`}
          className={cn(
            "text-sm leading-snug font-normal",
            !enabled && "text-muted-foreground",
          )}
        >
          {REVIEW_ATTESTATION}
        </Label>
      </div>

      <div className="grid gap-1.5">
        <Label
          htmlFor={`${uid}-notes`}
          className={cn("text-xs", !enabled && "text-muted-foreground")}
        >
          Notes
        </Label>
        <Textarea
          id={`${uid}-notes`}
          value={notes}
          disabled={!enabled}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            enabled
              ? "Anything the author should know — concerns, suggested edits, context."
              : "No notes."
          }
          className="field-sizing-content min-h-9 resize-y disabled:opacity-80"
        />
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {enabled ? (
            <>
              <Button
                type="submit"
                size="sm"
                className="cursor-pointer"
                disabled={isPending || !attested}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isNew ? "Submit review" : "Save"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                disabled={isPending}
                onClick={() => (isNew ? onDone?.() : reset())}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit review
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive cursor-pointer"
                disabled={isPending}
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Withdraw
              </Button>
            </>
          )}
        </div>
      )}
    </form>
  );
}
