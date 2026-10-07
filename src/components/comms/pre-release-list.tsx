"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ApprovalJSON } from "@catalog/models/approval";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  MoreHorizontal,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolvePreReleaseRecipients } from "@/core/mailers/recipients";
import { cn } from "@/lib/utils";

import { NewReviewDialog, ReviewKanbanBoard } from "./review-kanban-board";
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

type SortKey = "name" | "targetReleaseDate" | "status" | "createdAt";
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

/**
 * Status orders by release, then review progress, so ascending runs from
 * unreviewed drafts to released forms.
 */
function sortValue(a: ApprovalJSON, key: SortKey): string | number | null {
  switch (key) {
    case "name":
      return a.name.toLowerCase();
    case "targetReleaseDate":
      return a.targetReleaseDate;
    case "createdAt":
      return a.createdAt;
    case "status":
      return (a.isReleased ? 1000 : 0) + a.reviewCount;
  }
}

/** Sort a copy; missing dates go last in both directions. */
function sortApprovals(list: ApprovalJSON[], sort: Sort): ApprovalJSON[] {
  if (!sort) return list;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...list].sort((x, y) => {
    const a = sortValue(x, sort.key);
    const b = sortValue(y, sort.key);
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return (a < b ? -1 : 1) * sign;
  });
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  const dir = sort?.key === sortKey ? sort.dir : null;
  return (
    <button
      type="button"
      className="flex cursor-pointer items-center gap-1 select-none"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {dir === "asc" ? (
        <ArrowUp className="size-3" />
      ) : dir === "desc" ? (
        <ArrowDown className="size-3" />
      ) : (
        <ArrowUpDown className="text-muted-foreground size-3" />
      )}
    </button>
  );
}

export function PreReleaseList({
  approvals,
  authors,
  activeAuthor,
  reviews,
  currentUserId,
  currentUserName,
  isAdmin,
  isDev,
  emptyMessage = "No pre-release forms submitted yet.",
}: {
  approvals: ApprovalJSON[];
  /** Lead authors offered by the filter select. */
  authors: { id: number; name: string }[];
  /** User id from `?author=`, when the list is filtered to one author. */
  activeAuthor?: number;
  /** Reviews keyed by approval id. */
  reviews: Record<string, ApprovalReviewJSON[]>;
  currentUserId: number;
  currentUserName: string;
  isAdmin: boolean;
  isDev: boolean;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const base = "/comms/pub-form";

  const [sort, setSort] = useState<Sort>(null);
  // Click cycles ascending → descending → unsorted (server order).
  const cycleSort = (key: SortKey) =>
    setSort((s) =>
      s?.key !== key
        ? { key, dir: "asc" }
        : s.dir === "asc"
          ? { key, dir: "desc" }
          : null,
    );
  const sorted = useMemo(
    () => sortApprovals(approvals, sort),
    [approvals, sort],
  );
  const ariaSort = (key: SortKey) =>
    sort?.key === key
      ? sort.dir === "asc"
        ? "ascending"
        : "descending"
      : undefined;

  // The author filter lives in the URL (like the status tabs) so the server
  // can apply it to the tab counts too.
  function selectAuthor(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "list");
    if (value === "all") params.delete("author");
    else params.set("author", value);
    router.push(`/comms?${params}`);
  }
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(set: Set<number>, id: number, force?: boolean): Set<number> {
    const next = new Set(set);
    const on = force ?? !next.has(id);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  }
  const toggleExpanded = (id: number) => setExpanded((s) => toggle(s, id));
  const [creatingFor, setCreatingFor] = useState<ApprovalJSON | null>(null);
  function openAddReview(a: ApprovalJSON) {
    setExpanded((s) => toggle(s, a.id, true));
    setCreatingFor(a);
  }

  // Authors may review their own forms — many are filed on their behalf.
  const canReview = (a: ApprovalJSON) => !a.reviewedByMe;
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

  // Nothing at all and no filter to clear: skip the empty table.
  if (!approvals.length && !activeAuthor) {
    return <p className="text-muted-foreground py-8 text-sm">{emptyMessage}</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead aria-sort={ariaSort("name")}>
              <SortHeader
                label="Title"
                sortKey="name"
                sort={sort}
                onSort={cycleSort}
              />
            </TableHead>
            <TableHead>
              {/* The header itself opens the author filter; when one is
                  picked it shows that name so the filter stays visible. */}
              <Select
                value={activeAuthor ? String(activeAuthor) : "all"}
                onValueChange={selectAuthor}
              >
                <SelectTrigger
                  className={cn(
                    "h-auto cursor-pointer gap-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent",
                    activeAuthor && "text-primary",
                  )}
                  aria-label="Filter by lead author"
                >
                  <SelectValue>
                    {authors.find((u) => u.id === activeAuthor)?.name ??
                      "Lead author"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All authors</SelectItem>
                  {authors.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableHead>
            <TableHead aria-sort={ariaSort("targetReleaseDate")}>
              <SortHeader
                label="Target release"
                sortKey="targetReleaseDate"
                sort={sort}
                onSort={cycleSort}
              />
            </TableHead>
            <TableHead aria-sort={ariaSort("status")}>
              <SortHeader
                label="Status"
                sortKey="status"
                sort={sort}
                onSort={cycleSort}
              />
            </TableHead>
            <TableHead aria-sort={ariaSort("createdAt")}>
              <SortHeader
                label="Submitted"
                sortKey="createdAt"
                sort={sort}
                onSort={cycleSort}
              />
            </TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!sorted.length && (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={7}
                className="text-muted-foreground py-8 text-sm"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
          {sorted.map((a) => {
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
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(canReview(a) || canModify(a)) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 cursor-pointer"
                            title="Actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canReview(a) && (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onSelect={() => openAddReview(a)}
                            >
                              <ClipboardCheck className="h-4 w-4" />
                              Add review
                            </DropdownMenuItem>
                          )}
                          {canModify(a) && (
                            <>
                              <DropdownMenuItem
                                asChild
                                className="cursor-pointer"
                              >
                                <Link href={`${base}/${a.id}/edit`}>
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onSelect={() => setPendingResend(a)}
                              >
                                <Send className="h-4 w-4" />
                                Resend notification
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                className="cursor-pointer"
                                onSelect={() => setPendingDelete(a)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>

                {isOpen && (
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell colSpan={7} className="p-2 sm:pl-10">
                      <div className="border-muted-foreground/40 bg-background/40 space-y-4 rounded-md border border-dashed px-3 py-2">
                        <ReviewKanbanBoard
                          reviews={list}
                          approvals={{ [a.id]: a }}
                          canDrag={() => canModify(a)}
                          currentUserId={currentUserId}
                          addReview={
                            canReview(a)
                              ? { approvalId: a.id, currentUserName }
                              : undefined
                          }
                        />
                        {/* Temporarily hidden while iterating on the kanban board.
                        <ReviewTable
                          approvalId={a.id}
                          reviews={list}
                          currentUserId={currentUserId}
                          currentUserName={currentUserName}
                          isDev={isDev}
                          canAdd={canReview(a)}
                        />
                        */}
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

      {creatingFor && (
        <NewReviewDialog
          approval={creatingFor}
          currentUserName={currentUserName}
          onClose={() => setCreatingFor(null)}
        />
      )}
    </>
  );
}
