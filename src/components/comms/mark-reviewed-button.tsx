"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { setApprovalSuperReviewed } from "@/actions/approvals";
import { Button } from "@/components/ui/button";
import { toastActionError, unwrapAction } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/**
 * Toggles a form's manual "reviewed" mark, for forms that don't need the full
 * REQUIRED_REVIEWS sign-offs; shown to the author and admins. Pressed (green)
 * whenever the form counts as reviewed. A form reviewed by count alone has no
 * mark to undo, so the toggle is locked on.
 */
export function MarkReviewedButton({
  approvalId,
  isReviewed,
  isSuperReviewed,
}: {
  approvalId: number;
  isReviewed: boolean;
  isSuperReviewed: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const reviewedByCount = isReviewed && !isSuperReviewed;

  function handleMark(reviewed: boolean) {
    startTransition(async () => {
      try {
        const result = unwrapAction(
          await setApprovalSuperReviewed(approvalId, reviewed),
        );
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toastActionError(err, "Update failed");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={isReviewed}
      title={
        reviewedByCount
          ? "Has all required reviews"
          : isSuperReviewed
            ? "Click to undo"
            : undefined
      }
      className={cn(
        // dark: variants override the outline button's own dark-mode hover.
        "w-36 cursor-pointer hover:border-emerald-600 hover:bg-emerald-600 hover:text-white dark:hover:border-emerald-600 dark:hover:bg-emerald-600",
        isReviewed &&
          "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-100 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700",
      )}
      disabled={isPending || reviewedByCount}
      onClick={() => handleMark(!isSuperReviewed)}
    >
      <CheckCircle2 className="h-4 w-4" />
      {isReviewed ? "Reviewed" : "Mark reviewed"}
    </Button>
  );
}
