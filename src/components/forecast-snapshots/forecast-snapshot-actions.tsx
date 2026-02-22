"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { TsdSeries } from "@catalog/utils/tsd-reader";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteSnapshotAction,
  duplicateSnapshotAction,
} from "@/actions/forecast-snapshots";
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

interface Props {
  snapshotId: number;
  snapshotName: string;
  view: "chart" | "table";
  newForecast: TsdSeries[];
  oldForecast: TsdSeries[];
  history: TsdSeries[];
  allDates: string[];
}

export function ForecastSnapshotActions({
  snapshotId,
  snapshotName,
  view,
  newForecast,
  oldForecast,
  history,
  allDates,
}: Props) {
  const router = useRouter();
  const { universe, id } = useParams();
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const result = await duplicateSnapshotAction(snapshotId);
      if (result.success) {
        toast.success(result.message);
        router.push(`/udaman/${universe}/forecast/snapshots/${result.id}`);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteSnapshotAction(snapshotId);
      if (result.success) {
        toast.success(result.message);
        router.push(`/udaman/${universe}/forecast/snapshots`);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeleting(false);
    }
  };

  const handlePermalink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Permalink copied to clipboard");
  }, []);

  const handleExportCsv = useCallback(() => {
    const nameOrder = new Map<string, number>();
    newForecast.forEach((s, i) => {
      if (!nameOrder.has(s.name)) nameOrder.set(s.name, i);
    });
    const allNames = new Set<string>();
    for (const s of newForecast) allNames.add(s.name);
    for (const s of oldForecast) allNames.add(s.name);
    for (const s of history) allNames.add(s.name);

    const orderedNames = [...allNames].sort((a, b) => {
      const oa = nameOrder.get(a) ?? Infinity;
      const ob = nameOrder.get(b) ?? Infinity;
      return oa - ob;
    });

    const nMap = new Map(newForecast.map((s) => [s.name, s]));
    const oMap = new Map(oldForecast.map((s) => [s.name, s]));
    const hMap = new Map(history.map((s) => [s.name, s]));

    const columns: Array<{ header: string; series: TsdSeries | undefined }> =
      [];
    for (const name of orderedNames) {
      columns.push({ header: `${name} (new)`, series: nMap.get(name) });
      columns.push({ header: `${name} (old)`, series: oMap.get(name) });
      columns.push({ header: `${name} (his)`, series: hMap.get(name) });
    }

    const header = ["Date", ...columns.map((c) => c.header)];
    const csvRows = allDates.map((date) => {
      const vals = columns.map((col) => {
        const val = col.series?.dataHash.get(date);
        if (val === null || val === undefined) return "";
        return val.toFixed(3);
      });
      return [date, ...vals];
    });

    const csvContent = [header, ...csvRows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forecast_snapshot.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [newForecast, oldForecast, history, allDates]);

  const togglePath =
    view === "chart"
      ? `/udaman/${universe}/forecast/snapshots/${id}/table`
      : `/udaman/${universe}/forecast/snapshots/${id}`;

  return (
    <>
      <Button variant="link" size="sm" onClick={() => router.push(togglePath)}>
        {view === "chart" ? "Table View" : "Chart View"}
      </Button>
      <Button variant="link" size="sm" onClick={handlePermalink}>
        Permalink
      </Button>
      <Button variant="link" size="sm" onClick={handleExportCsv}>
        Download CSV
      </Button>
      <Button
        variant="link"
        size="sm"
        onClick={() =>
          router.push(`/udaman/${universe}/forecast/snapshots/${id}/edit`)
        }
      >
        Edit
      </Button>
      <Button
        variant="link"
        size="sm"
        onClick={handleDuplicate}
        disabled={duplicating}
      >
        {duplicating ? "Duplicating..." : "Duplicate"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={deleting}>
            {/* {deleting ? "Deleting..." : "Destroy"} */}
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Snapshot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{snapshotName}&rdquo;? This
              will permanently remove the snapshot and all associated TSD files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
