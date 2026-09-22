"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "lucide-react";
import { toast } from "sonner";

import { deleteSeries } from "@/actions/series-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: number;
  seriesName: string | null;
  universe: string;
}

export function DeleteSeriesDialog({
  open,
  onOpenChange,
  seriesId,
  seriesName,
  universe,
}: DeleteSeriesDialogProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSeries(seriesId, universe);
      toast.success(`Series "${seriesName}" destroyed`);
      onOpenChange(false);
      router.push(`/udaman/${universe}/series`);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to destroy series";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Destroy Series</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to destroy{" "}
            <strong>{seriesName || "this series"}</strong>? This will
            permanently delete all associated data points, loaders, and
            measurement links. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="cursor-pointer bg-red-700/40 font-bold text-red-700 hover:bg-red-700/90 hover:text-white"
          >
            <Trash className="inline-block h-4 w-4 font-bold" />
            {isDeleting ? "Destroying..." : "Destroy"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
