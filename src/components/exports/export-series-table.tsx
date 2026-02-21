"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteExportAction } from "@/actions/exports";
import type { ExportSeriesRow } from "@catalog/collections/export-collection";
import { Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: undefined,
  });
}

interface Props {
  exportId: number;
  exportName: string;
  series: ExportSeriesRow[];
  universe: string;
}

export function ExportSeriesTable({
  exportId,
  exportName,
  series,
  universe,
}: Props) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteExportAction(exportId);
    setDeleting(false);
    setShowDelete(false);
    if (result.success) {
      toast.success(result.message);
      router.push(`/udaman/${universe}/exports`);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{series.length} series</p>
        <div className="flex items-center gap-1">
          <Button variant="link" size="sm" asChild>
            <Link href={`/udaman/${universe}/exports/${exportId}/edit`}>
              Edit
            </Link>
          </Button>
          <Button variant="link" size="sm" asChild>
            <Link href={`/udaman/${universe}/exports/${exportId}/table`}>
              Table
            </Link>
          </Button>
          <Button variant="link" size="sm" asChild>
            <a href={`/api/exports/${exportId}/csv`} download>
              CSV
            </a>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="cursor-pointer"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Order</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-12">SA</TableHead>
              <TableHead>Portal Name</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>First</TableHead>
              <TableHead>Last</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.length ? (
              series.map((row) => (
                <TableRow key={row.seriesId} className="odd:bg-muted">
                  <TableCell>{row.order}</TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1">
                      <Link
                        href={`/udaman/${universe}/series/${row.seriesId}`}
                        className="hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.restricted && (
                        <Ban className="text-destructive inline size-3.5" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{row.seasonalAdjustment ?? "-"}</TableCell>
                  <TableCell>{row.dataPortalName ?? "-"}</TableCell>
                  <TableCell>
                    {row.unitShortLabel ? (
                      row.unitLongLabel ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">
                              {row.unitShortLabel}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{row.unitLongLabel}</TooltipContent>
                        </Tooltip>
                      ) : (
                        row.unitShortLabel
                      )
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(row.minDate)}</TableCell>
                  <TableCell>{formatDate(row.maxDate)}</TableCell>
                  <TableCell className="max-w-48 truncate">
                    {row.sourceDescription ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No series linked to this export.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={showDelete}
        onOpenChange={(open) => !open && setShowDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Export</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{exportName}&rdquo; and remove
              all series associations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
