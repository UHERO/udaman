"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";
import { Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { deleteReview, submitReview } from "@/actions/approvals";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function formatReviewTimestamp(value: string | null): string {
  if (!value) return "";
  return `${new Date(value).toLocaleString("en-US", {
    timeZone: "Pacific/Honolulu",
    dateStyle: "medium",
    timeStyle: "short",
  })} HST`;
}

/**
 * One review per row: Reviewed (checkbox + when) · Name · Notes · Edit.
 *
 * Inputs are disabled until the row's own author (or a dev) ticks Edit,
 * which also reveals Save/Withdraw. Unticking Edit discards the draft.
 *
 * When the viewer may add a review, the last row is an "Add review"
 * affordance occupying the space the new row will take; clicking it fades
 * the button out and the blank, enabled form row in.
 */
export function ReviewTable({
  approvalId,
  reviews,
  currentUserId,
  currentUserName,
  isDev,
  canAdd,
}: {
  approvalId: number;
  reviews: ApprovalReviewJSON[];
  currentUserId: number;
  /** Shown in the Name cell of the add row before the review exists. */
  currentUserName: string;
  isDev: boolean;
  /** Viewer hasn't reviewed yet and is allowed to. */
  canAdd: boolean;
}) {
  // button → fading (button dissolving) → form
  const [phase, setPhase] = useState<"button" | "fading" | "form">("button");
  useEffect(() => {
    if (phase !== "fading") return;
    const t = setTimeout(() => setPhase("form"), 150);
    return () => clearTimeout(t);
  }, [phase]);
  // If the review lands (or the right to add goes away), fall back to the button.
  useEffect(() => {
    if (!canAdd) setPhase("button");
  }, [canAdd]);

  if (!reviews.length && !canAdd) {
    return <p className="text-muted-foreground text-sm">No reviews yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-44">Reviewed</TableHead>
            <TableHead className="w-44">Name</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-16 text-center">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((r) => (
            <ReviewRow
              key={r.id}
              approvalId={approvalId}
              review={r}
              canEdit={isDev || r.reviewerUserId === currentUserId}
              isOwn={r.reviewerUserId === currentUserId}
            />
          ))}
          {canAdd && phase !== "form" && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="p-1">
                <button
                  type="button"
                  onClick={() => setPhase("fading")}
                  disabled={phase === "fading"}
                  className={cn(
                    "text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-3 px-2 py-2 text-sm transition-opacity duration-150",
                    phase === "fading" && "opacity-0",
                  )}
                >
                  <span className="border-border flex-1 border-t border-dashed" />
                  <span className="inline-flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add review
                  </span>
                  <span className="border-border flex-1 border-t border-dashed" />
                </button>
              </TableCell>
            </TableRow>
          )}
          {canAdd && phase === "form" && (
            <ReviewRow
              approvalId={approvalId}
              review={null}
              canEdit
              isOwn
              reviewerName={currentUserName}
              onDone={() => setPhase("button")}
              className="animate-in fade-in duration-200"
            />
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ReviewRow({
  approvalId,
  review,
  canEdit,
  isOwn,
  reviewerName,
  onDone,
  className,
}: {
  approvalId: number;
  review: ApprovalReviewJSON | null;
  canEdit: boolean;
  isOwn: boolean;
  reviewerName?: string;
  onDone?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isNew = !review;
  const [editing, setEditing] = useState(isNew);
  const [attested, setAttested] = useState(review?.attested ?? false);
  const [notes, setNotes] = useState(review?.notes ?? "");
  const enabled = editing && canEdit;
  const dirty =
    isNew ||
    attested !== (review?.attested ?? false) ||
    notes !== (review?.notes ?? "");

  function cancel() {
    if (isNew) return onDone?.();
    setAttested(review?.attested ?? false);
    setNotes(review?.notes ?? "");
    setEditing(false);
  }

  function save() {
    startTransition(async () => {
      try {
        const result = await submitReview(approvalId, { attested, notes });
        toast.success(result.message);
        setEditing(false);
        onDone?.();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function withdraw() {
    if (!review) return;
    startTransition(async () => {
      try {
        const result = await deleteReview(review.id);
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not withdraw");
      }
    });
  }

  const uid = `review-${approvalId}-${review?.id ?? "new"}`;
  // Editable controls sit on white so they read as inputs; disabled ones
  // fade into the row.
  const controlBg = enabled
    ? "bg-background dark:bg-input/60"
    : "bg-muted/40 border-transparent";
  const name = review?.reviewer ?? reviewerName ?? "";

  return (
    <TableRow
      data-state={editing ? "selected" : undefined}
      className={className}
    >
      <TableCell className="align-baseline">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${uid}-reviewed`}
            checked={attested}
            disabled={!enabled}
            onCheckedChange={(v) => setAttested(v === true)}
            aria-label="Reviewed"
            className={cn("translate-y-px", controlBg)}
          />
          <label
            htmlFor={`${uid}-reviewed`}
            className="text-muted-foreground text-xs leading-snug"
          >
            {review?.reviewedAt
              ? formatReviewTimestamp(review.reviewedAt)
              : attested
                ? "'Submit' to complete"
                : "Click to mark reviewed"}
          </label>
        </div>
      </TableCell>
      <TableCell className="align-baseline text-sm">
        {name}
        {isOwn && <span className="text-muted-foreground text-xs"> (you)</span>}
      </TableCell>
      <TableCell className="align-baseline">
        <Textarea
          value={notes}
          disabled={!enabled}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={enabled ? "Notes for author or comms team..." : "—"}
          aria-label="Notes"
          className={cn(
            "field-sizing-content min-h-8 resize-y py-1 text-sm disabled:cursor-default disabled:opacity-80",
            controlBg,
          )}
        />
        {enabled && (
          <div className="mt-2 flex items-center justify-between gap-2">
            {isNew ? (
              <span />
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={withdraw}
                className="text-muted-foreground hover:text-destructive cursor-pointer text-xs underline-offset-4 hover:underline"
              >
                Withdraw review
              </button>
            )}
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 cursor-pointer px-2 text-xs"
                disabled={isPending}
                onClick={cancel}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 cursor-pointer px-2 text-xs"
                disabled={isPending || !dirty}
                onClick={save}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isNew ? (
                  <Plus className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {isNew ? "Submit" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </TableCell>
      <TableCell className="text-center align-baseline">
        {canEdit && !isNew && (
          <Checkbox
            checked={editing}
            onCheckedChange={(v) => (v === true ? setEditing(true) : cancel())}
            aria-label="Edit review"
            disabled={isPending}
            className="translate-y-px"
          />
        )}
      </TableCell>
    </TableRow>
  );
}
