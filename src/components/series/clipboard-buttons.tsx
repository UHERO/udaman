"use client";

import { useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClipboardCopy, ClipboardPlus } from "lucide-react";
import { toast } from "sonner";

import {
  addMultipleSeriesToClipboard,
  clearClipboard,
} from "@/actions/clipboard-actions";
import { Button } from "@/components/ui/button";

interface ClipboardButtonsProps {
  seriesIds: number[];
}

export function ClipboardButtons({ seriesIds }: ClipboardButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { universe } = useParams();

  const handleAdd = () => {
    startTransition(async () => {
      try {
        const result = await addMultipleSeriesToClipboard(seriesIds);
        toast.success(result.message);
        router.push(`/udaman/${universe}/series/clipboard`);
      } catch (err) {
        toast.error("Failed to add to clipboard", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });
  };

  const handleReplace = () => {
    startTransition(async () => {
      try {
        await clearClipboard();
        const result = await addMultipleSeriesToClipboard(seriesIds);
        toast.success(`Clipboard replaced: ${result.count} series`);
        router.push(`/udaman/${universe}/series/clipboard`);
      } catch (err) {
        toast.error("Failed to replace clipboard", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });
  };

  return (
    <div>
      <Button
        variant="ghost"
        disabled={isPending || seriesIds.length === 0}
        onClick={handleAdd}
      >
        <ClipboardPlus className="mr-2 h-4 w-4" />
        Add to Clipboard
      </Button>
      <Button
        variant="ghost"
        disabled={isPending || seriesIds.length === 0}
        onClick={handleReplace}
      >
        <ClipboardCopy className="mr-2 h-4 w-4" />
        Replace Clipboard
      </Button>
    </div>
  );
}
