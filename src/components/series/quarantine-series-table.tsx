"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { SeriesAuditRow } from "@catalog/types/shared";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  emptyQuarantine,
  getQuarantinedSeries,
  unquarantineSeries,
} from "@/actions/series-actions";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PER_PAGE = 50;

export function QuarantineSeriesTable({ universe }: { universe: string }) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SeriesAuditRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const fetchData = useCallback(
    (p: number) => {
      startTransition(async () => {
        const result = await getQuarantinedSeries(universe, p, PER_PAGE);
        setRows(result.rows);
        setTotalCount(result.totalCount);
      });
    },
    [universe],
  );

  useEffect(() => {
    fetchData(page);
  }, [page, fetchData]);

  const handleUnquarantine = (seriesId: number) => {
    const series = rows.find((r) => r.id === seriesId);
    startTransition(async () => {
      try {
        await unquarantineSeries(seriesId, universe);
        toast.success("Series removed from quarantine", {
          description: series?.name ?? `Series ${seriesId}`,
        });
        fetchData(page);
      } catch (err) {
        toast.error("Unquarantine failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });
  };

  const handleEmptyQuarantine = () => {
    startTransition(async () => {
      try {
        const count = await emptyQuarantine(universe);
        toast.success("Quarantine emptied", {
          description: `${count} series unquarantined`,
        });
        setPage(1);
        fetchData(1);
      } catch (err) {
        toast.error("Empty quarantine failed", {
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
            <>{totalCount} quarantined series</>
          )}
        </p>

        {totalCount > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isPending}>
                Empty Quarantine
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Empty quarantine?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all {totalCount} series from quarantine,
                  making them visible to public-facing systems. This may take
                  some time if there are many series quarantined.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleEmptyQuarantine}>
                  Empty Quarantine
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-64">Name</TableHead>
            <TableHead className="w-64">Data Portal Name</TableHead>
            <TableHead>Loaders</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && !isPending ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground h-24 text-center"
              >
                No quarantined series.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">
                  <Link
                    href={`/udaman/${universe}/series/${row.id}`}
                    className="text-primary hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  {row.dataPortalName ?? "-"}
                </TableCell>
                <TableCell className="max-w-md text-xs">
                  {row.loaderEvals.length > 0 ? (
                    <div className="space-y-0.5">
                      {row.loaderEvals.map((e, i) => (
                        <div
                          key={i}
                          className="text-muted-foreground truncate font-mono"
                          title={e}
                        >
                          {e}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleUnquarantine(row.id)}
                  >
                    Unquarantine
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
