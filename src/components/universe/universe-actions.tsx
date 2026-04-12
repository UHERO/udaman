"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Trash } from "lucide-react";
import { toast } from "sonner";

import {
  archiveUniverseAction,
  purgeUniverseAction,
} from "@/actions/universes";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UniverseActionsProps {
  name: string;
  universes: { name: string }[];
}

/** Return "YYYY-MM-DDThh:mm" in HST for use as a datetime-local default. */
function defaultHstDatetime(): string {
  const now = new Date();
  // HST is always UTC-10
  const hst = new Date(now.getTime() - 10 * 60 * 60 * 1000);
  return hst.toISOString().slice(0, 16);
}

/** Convert a datetime-local value (assumed HST) to an ISO string (UTC). */
function hstLocalToIso(local: string): string {
  // datetime-local gives "YYYY-MM-DDThh:mm", treat as HST (UTC-10)
  return new Date(local + ":00-10:00").toISOString();
}

export function UniverseActions({ name, universes }: UniverseActionsProps) {
  const router = useRouter();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveTime, setArchiveTime] = useState(defaultHstDatetime);
  const [isArchiving, setIsArchiving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTime, setDeleteTime] = useState(defaultHstDatetime);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const result = await archiveUniverseAction(
        name,
        hstLocalToIso(archiveTime),
      );
      if (result.success) {
        toast.success(result.message);
        setArchiveOpen(false);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule archive",
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await purgeUniverseAction(
        name,
        hstLocalToIso(deleteTime),
      );
      if (result.success) {
        toast.success(result.message);
        setDeleteOpen(false);
        setConfirmText("");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule delete",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer"
        onClick={() => {
          setArchiveTime(defaultHstDatetime());
          setArchiveOpen(true);
        }}
      >
        <Archive className="mr-2 h-4 w-4" />
        Archive
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer border-red-700/40 text-red-700 hover:bg-red-700/10"
        onClick={() => {
          setDeleteTime(defaultHstDatetime());
          setDeleteOpen(true);
        }}
      >
        <Trash className="mr-2 h-4 w-4" />
        Delete
      </Button>

      {/* ── Archive dialog ─────────────────────────────────────── */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule Archive</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Schedule a background job to export all{" "}
                  <strong>{name}</strong> data to CSV files on the server.
                </p>
                <div className="mt-3">
                  <Label htmlFor="archive-time">Run at (HST)</Label>
                  <Input
                    id="archive-time"
                    type="datetime-local"
                    className="mt-1"
                    value={archiveTime}
                    onChange={(e) => setArchiveTime(e.target.value)}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={isArchiving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving || !archiveTime}
              className="cursor-pointer"
            >
              {isArchiving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Archive className="mr-2 h-4 w-4" />
              )}
              {isArchiving ? "Scheduling..." : "Schedule Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete dialog ──────────────────────────────────────── */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setConfirmText("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Universe</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  This will schedule a job to permanently delete{" "}
                  <strong>{name}</strong> and all related data including series,
                  categories, measurements, geographies, data points, and more.
                  Shared data referenced by other universes will be preserved.
                </p>
                <p className="mt-2 font-medium">
                  The delete job requires an archive created within the last 24
                  hours. If no recent archive exists, the job will fail safely.
                </p>
                <p className="mt-2">This action cannot be undone.</p>
                <div className="mt-3">
                  <Label htmlFor="delete-time">Run at (HST)</Label>
                  <Input
                    id="delete-time"
                    type="datetime-local"
                    className="mt-1"
                    value={deleteTime}
                    onChange={(e) => setDeleteTime(e.target.value)}
                  />
                </div>
                <p className="mt-3 text-sm font-medium">
                  Type <strong>{name}</strong> to confirm:
                </p>
                <Input
                  className="mt-2"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={name}
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== name || !deleteTime}
              className="cursor-pointer bg-red-700/40 font-bold text-red-700 hover:bg-red-700/90 hover:text-white"
            >
              <Trash className="inline-block h-4 w-4 font-bold" />
              {isDeleting ? "Scheduling..." : "Delete Universe"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
