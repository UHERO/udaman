"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { setApprovalReleased } from "@/actions/approvals";
import { Button } from "@/components/ui/button";
import { toastActionError, unwrapAction } from "@/lib/action-result";

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
      variant={isReleased ? "outline" : "default"}
      className="cursor-pointer"
      disabled={isPending}
      onClick={() => handleRelease(!isReleased)}
    >
      {isReleased ? (
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
  );
}
