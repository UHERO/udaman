"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

import { setApprovalReleased } from "@/actions/approvals";
import { Button } from "@/components/ui/button";
import { toastActionError, unwrapAction } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/** Toggles a form's released state; shown to the author and admins. */
export function ReleaseButton({
  approvalId,
  isReleased,
}: {
  approvalId: number;
  isReleased: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRelease(released: boolean) {
    startTransition(async () => {
      try {
        const result = unwrapAction(
          await setApprovalReleased(approvalId, released),
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
      aria-pressed={isReleased}
      title={isReleased ? "Click to undo" : undefined}
      className={cn(
        // dark: variants override the outline button's own dark-mode hover.
        "hover:border-ublue hover:bg-ublue dark:hover:border-ublue dark:hover:bg-ublue w-36 cursor-pointer hover:text-white",
        isReleased &&
          "border-ublue bg-ublue hover:bg-ublue/90 dark:border-ublue dark:bg-ublue dark:hover:bg-ublue/90 text-white",
      )}
      disabled={isPending}
      onClick={() => handleRelease(!isReleased)}
    >
      <Rocket className="h-4 w-4" />
      {isReleased ? "Released" : "Mark released"}
    </Button>
  );
}
