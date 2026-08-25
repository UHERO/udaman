"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApprovalJSON } from "@catalog/models/approval";
import { Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteApproval,
  resendApprovalNotification,
} from "@/actions/approvals";
import { ApprovalStatusBadges } from "@/components/comms/approval-status";
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
import { resolvePreReleaseRecipients } from "@/core/mailers/recipients";

/** Render a `YYYY-MM-DD` string without letting the local timezone shift the day. */
function formatDate(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PreReleaseList({
  approvals,
  currentUserId,
  isAdmin,
  emptyMessage = "No pre-release forms submitted yet.",
}: {
  approvals: ApprovalJSON[];
  currentUserId: number;
  isAdmin: boolean;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const base = "/comms/pub-form";
  const [pendingDelete, setPendingDelete] = useState<ApprovalJSON | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingResend, setPendingResend] = useState<ApprovalJSON | null>(null);
  const [resending, setResending] = useState(false);

  const canModify = (a: ApprovalJSON) =>
    isAdmin || a.authorUserId === currentUserId;

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const result = await deleteApproval(pendingDelete.id);
      toast.success(result.message);
      setPendingDelete(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete the form",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function confirmResend() {
    if (!pendingResend) return;
    setResending(true);
    try {
      const result = await resendApprovalNotification(pendingResend.id);
      toast.success(result.message);
      setPendingResend(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to send the notification",
      );
    } finally {
      setResending(false);
    }
  }

  if (!approvals.length) {
    return <p className="text-muted-foreground py-8 text-sm">{emptyMessage}</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Lead author</TableHead>
            <TableHead>Target release</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {approvals.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">
                <Link href={`${base}/${a.id}`} className="hover:underline">
                  {a.name}
                </Link>
              </TableCell>
              <TableCell>{a.author}</TableCell>
              <TableCell>{formatDate(a.targetReleaseDate)}</TableCell>
              <TableCell>
                <ApprovalStatusBadges approval={a} />
              </TableCell>
              <TableCell>{formatDate(a.createdAt)}</TableCell>
              <TableCell>
                {canModify(a) && (
                  <div className="flex justify-end gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit"
                    >
                      <Link href={`${base}/${a.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 cursor-pointer"
                      title="Resend notification"
                      onClick={() => setPendingResend(a)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-7 w-7 cursor-pointer"
                      title="Delete"
                      onClick={() => setPendingDelete(a)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this pre-release form?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.name}&rdquo; will be removed from this
              list. The record is retained for audit purposes and can be
              restored by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingResend}
        onOpenChange={(open) => !open && setPendingResend(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend the notification email?</AlertDialogTitle>
            <AlertDialogDescription>
              The submission notification for &ldquo;{pendingResend?.name}
              &rdquo; will be emailed to:{" "}
              {pendingResend
                ? resolvePreReleaseRecipients(pendingResend.formData).join(", ")
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={resending}
              onClick={(e) => {
                e.preventDefault();
                void confirmResend();
              }}
            >
              {resending ? "Sending…" : "Send"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
