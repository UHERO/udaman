"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { setApprovalReleased } from "@/actions/approvals";
import { Button } from "@/components/ui/button";

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
        const result = await setApprovalReleased(approvalId, released);
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
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
