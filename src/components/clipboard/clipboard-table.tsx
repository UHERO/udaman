"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ChevronDown,
  Loader2,
  RotateCw,
  Trash2,
  X,
  Lock,
  Unlock,
  FileSpreadsheet,
  FileText,
  Eraser,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import type { ClipboardAction } from "@catalog/controllers/clipboard";
import type { ClipboardSeriesRow } from "@catalog/collections/clipboard-collection";

import {
  getClipboardSeries,
  removeSeriesFromClipboard,
  clearClipboard,
  executeClipboardAction,
} from "@/actions/clipboard-actions";

import { ClipboardMetadataDialog } from "./clipboard-metadata-dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CLIPBOARD_ACTIONS: {
  action: ClipboardAction;
  label: string;
  icon: React.ElementType;
  destructive?: boolean;
}[] = [
  { action: "reload", label: "Reload", icon: RotateCw },
  { action: "reset", label: "Reset Loaders", icon: RefreshCw },
  { action: "clear_data", label: "Clear Data Points", icon: Eraser, destructive: true },
  { action: "restrict", label: "Restrict", icon: Lock },
  { action: "unrestrict", label: "Unrestrict", icon: Unlock },
  { action: "meta_update", label: "Bulk Metadata Update", icon: Pencil },
  { action: "export_csv", label: "Export CSV", icon: FileSpreadsheet },
  { action: "export_tsd", label: "Export TSD", icon: FileText },
  { action: "destroy", label: "Destroy All", icon: Trash2, destructive: true },
];

export function ClipboardTable({
  universe,
  initialData,
  initialCount,
}: {
  universe: string;
  initialData: ClipboardSeriesRow[];
  initialCount: number;
}) {
  const [rows, setRows] = useState<ClipboardSeriesRow[]>(initialData);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const result = await getClipboardSeries();
      setRows(result.data as ClipboardSeriesRow[]);
      setCount(result.count);
    });
  }, []);

  const handleRemove = (seriesId: number) => {
    const series = rows.find((r) => r.id === seriesId);
    startTransition(async () => {
      try {
        await removeSeriesFromClipboard(seriesId);
        toast.success("Removed from clipboard", {
          description: series?.name ?? `Series ${seriesId}`,
        });
        fetchData();
      } catch (err) {
        toast.error("Failed to remove series", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });
  };

  const handleClearAll = () => {
    startTransition(async () => {
      try {
        const result = await clearClipboard();
        toast.success("Clipboard cleared", {
          description: result.message,
        });
        fetchData();
      } catch (err) {
        toast.error("Failed to clear clipboard", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });
  };

  const handleAction = (action: ClipboardAction) => {
    // File exports are downloads — open in new tab
    if (action === "export_csv") {
      window.open("/api/clipboard/csv", "_blank");
      return;
    }
    if (action === "export_tsd") {
      window.open("/api/clipboard/tsd", "_blank");
      return;
    }
    // Metadata update opens a dialog
    if (action === "meta_update") {
      setMetadataDialogOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        const result = await executeClipboardAction(action);
        toast.info(result.message);
      } catch (err) {
        toast.error("Clipboard action failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {isPending ? (
            <Loader2 className="inline size-4 animate-spin" />
          ) : (
            <>{count} series on clipboard</>
          )}
        </p>

        <div className="flex gap-2">
          {count > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isPending}>
                    Actions
                    <ChevronDown className="ml-1 size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {CLIPBOARD_ACTIONS.map((item, i) => (
                    <span key={item.action}>
                      {item.destructive && i > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        onClick={() => handleAction(item.action)}
                        className={
                          item.destructive ? "text-destructive" : undefined
                        }
                      >
                        <item.icon className="mr-2 size-4" />
                        {item.label}
                      </DropdownMenuItem>
                    </span>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isPending}>
                    Clear Clipboard
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear clipboard?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {count} series from your clipboard.
                      The series themselves will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll}>
                      Clear Clipboard
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Geo</TableHead>
            <TableHead>Freq</TableHead>
            <TableHead>SA</TableHead>
            <TableHead>Units</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>First</TableHead>
            <TableHead>Last</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && !isPending ? (
            <TableRow>
              <TableCell
                colSpan={9}
                className="text-muted-foreground h-24 text-center"
              >
                No series on clipboard.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow key={row.id} className={i % 2 === 0 ? "bg-muted" : ""}>
                <TableCell className="font-mono text-sm">
                  <Link
                    href={`/udaman/${universe}/series/${row.id}`}
                    className="text-primary hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  {row.geography ?? "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {row.frequency ?? "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {row.seasonalAdjustment ?? "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {row.unitShortLabel ?? "-"}
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm">
                  {row.sourceDescription ?? "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {row.minDate ? format(new Date(row.minDate), "yyyy-MM-dd") : "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {row.maxDate ? format(new Date(row.maxDate), "yyyy-MM-dd") : "-"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={isPending}
                    onClick={() => handleRemove(row.id)}
                  >
                    <X className="size-4" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <ClipboardMetadataDialog
        open={metadataDialogOpen}
        onOpenChange={setMetadataDialogOpen}
        universe={universe}
        clipboardCount={count}
        onSuccess={fetchData}
      />
    </div>
  );
}
