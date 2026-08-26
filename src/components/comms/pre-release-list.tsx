"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApprovalJSON } from "@catalog/models/approval";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
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

import { ReviewTable } from "./review-table";

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
  reviews,
  currentUserId,
  currentUserName,
  isAdmin,
  isDev,
  canSelfReview = false,
  emptyMessage = "No pre-release forms submitted yet.",
}: {
  approvals: ApprovalJSON[];
  /** Reviews keyed by approval id. */
  reviews: Record<string, ApprovalReviewJSON[]>;
  currentUserId: number;
  currentUserName: string;
  isAdmin: boolean;
  isDev: boolean;
  /** Author may review their own forms (developer testing exemption). */
  canSelfReview?: boolean;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const base = "/comms/pub-form";
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(set: Set<number>, id: number, force?: boolean): Set<number> {
    const next = new Set(set);
    const on = force ?? !next.has(id);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  }
  const toggleExpanded = (id: number) => setExpanded((s) => toggle(s, id));
  const openAddReview = (id: number) => setExpanded((s) => toggle(s, id, true));

  const canReview = (a: ApprovalJSON) =>
    (canSelfReview || a.authorUserId !== currentUserId) && !a.reviewedByMe;
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
            <TableHead className="w-8" />
            <TableHead>Title</TableHead>
            <TableHead>Lead author</TableHead>
            <TableHead>Target release</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {approvals.map((a) => {
            const isOpen = expanded.has(a.id);
            const list = reviews[String(a.id)] ?? [];
            return (
              <Fragment key={a.id}>
                <TableRow
                  className="cursor-pointer"
                  data-state={isOpen ? "open" : undefined}
                  onClick={() => toggleExpanded(a.id)}
                >
                  <TableCell className="pr-0">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? "Collapse reviews" : "Show reviews"}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`${base}/${a.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.name}
                    </Link>
                  </TableCell>
                  <TableCell>{a.author}</TableCell>
                  <TableCell>{formatDate(a.targetReleaseDate)}</TableCell>
                  <TableCell>
                    <ApprovalStatusBadges approval={a} />
                  </TableCell>
                  <TableCell>{formatDate(a.createdAt)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {canReview(a) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 cursor-pointer"
                          title="Add review"
                          onClick={() => openAddReview(a.id)}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                        </Button>
                      )}
                      {canModify(a) && (
                        <>
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
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                {isOpen && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={7} className="p-0">
                      <div className="space-y-3 px-4 py-3 sm:pl-12">
                        <ReviewTable
                          approvalId={a.id}
                          reviews={list}
                          currentUserId={currentUserId}
                          currentUserName={currentUserName}
                          isDev={isDev}
                          canAdd={canReview(a)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
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
