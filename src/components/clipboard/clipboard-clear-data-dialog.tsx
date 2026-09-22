"use client";

import { useState, useTransition } from "react";
import type { DeleteByMode } from "@catalog/collections/series-collection";
import { toast } from "sonner";

import { executeClipboardAction } from "@/actions/clipboard-actions";
import {
  ClearDataOptions,
  clearModeLabel,
  clearModeNeedsDate,
} from "@/components/series/clear-data-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Bulk "Clear Data Points" dialog for the clipboard. Offers the same modes as
 * the Series Data Loader "Clear" dialog and queues a clear_data job that
 * applies the chosen mode to every series on the clipboard.
 */
export function ClipboardClearDataDialog({
  open,
  onOpenChange,
  clipboardCount,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clipboardCount: number;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [deleteBy, setDeleteBy] = useState<DeleteByMode>("none");
  const [date, setDate] = useState("");
  const needsDate = clearModeNeedsDate(deleteBy);

  const handleClear = () =>
    startTransition(async () => {
      try {
        if (needsDate && !date) {
          toast.error("Please enter a date");
          return;
        }
        const result = await executeClipboardAction("clear_data", {
          deleteBy,
          date: needsDate ? date : undefined,
        });
        toast.info(result.message, {
          description: `${clearModeLabel(deleteBy)}${needsDate ? `: ${date}` : ""}`,
        });
        onOpenChange(false);
        onSuccess?.();
      } catch (err) {
        toast.error("Clear failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Clear Data Points</DialogTitle>
          <DialogDescription>
            Choose how to clear data points for all {clipboardCount} clipboard
            series. This is queued as a background job.
          </DialogDescription>
        </DialogHeader>
        <ClearDataOptions
          deleteBy={deleteBy}
          onDeleteByChange={setDeleteBy}
          date={date}
          onDateChange={setDate}
          idPrefix="clipboard"
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={isPending || (needsDate && !date)}
          >
            {isPending ? "Queuing..." : "Clear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
