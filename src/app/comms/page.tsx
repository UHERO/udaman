import Link from "next/link";
import type { ApprovalStatusFilter } from "@catalog/models/approval";
import {
  APPROVAL_STATUS_FILTERS,
  APPROVAL_STATUS_LABELS,
  isApprovalStatusFilter,
  approvalMatchesStatus as matches,
  REQUIRED_REVIEWS,
} from "@catalog/models/approval";
import { Plus } from "lucide-react";

import {
  getApprovalsWithReviews,
  currentUserName as getCurrentUserName,
} from "@/actions/approvals";
import { AuthorReviewBoard } from "@/components/comms/author-review-board";
import { CommsPanel } from "@/components/comms/comms-panel";
import { CommsViewToggle } from "@/components/comms/comms-view-toggle";
import type { CommsView } from "@/components/comms/comms-view-toggle";
import { PreReleaseList } from "@/components/comms/pre-release-list";
import { PreReleaseStatusTabs } from "@/components/comms/pre-release-status-tabs";
import { ReviewerBoard } from "@/components/comms/reviewer-board";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/dal";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string; author?: string }>;
}) {
  const [{ approvals, reviews }, { userId, role }, { status, view, author }] =
    await Promise.all([
      getApprovalsWithReviews(),
      getCurrentUserContext(),
      searchParams,
    ]);
  const currentUserName = await getCurrentUserName();
  const currentUserId = parseInt(userId) || 0;
  const active: ApprovalStatusFilter = isApprovalStatusFilter(status)
    ? status
    : "not_reviewed";

  // No explicit ?view= yet: land wherever this user has something of their
  // own to do — their publications, then their reviews, else everyone's list.
  const defaultView: CommsView = approvals.some(
    (a) => a.authorUserId === currentUserId,
  )
    ? "board"
    : Object.values(reviews)
          .flat()
          .some((r) => r.reviewerUserId === currentUserId)
      ? "reviewing"
      : "list";
  const activeView: CommsView =
    view === "board"
      ? "board"
      : view === "reviewing"
        ? "reviewing"
        : view === "list"
          ? "list"
          : defaultView;

  // Lead-author filter for the list view. Options come from every form so
  // the select still lists authors whose forms the status tab hides.
  const authors = [
    ...new Map(approvals.map((a) => [a.authorUserId, a.author])).entries(),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const authorId = parseInt(author ?? "") || undefined;
  const byAuthor = authorId
    ? approvals.filter((a) => a.authorUserId === authorId)
    : approvals;
  const visible = byAuthor.filter((a) => matches(a, active));

  return (
    <div className="space-y-4">
      <CommsPanel bodyClassName="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Pre-Release Forms</h1>
            <p className="text-muted-foreground text-sm">
              Sign-off record filed by the lead author before a work product is
              released. A form is reviewed once {REQUIRED_REVIEWS} colleagues
              have signed off.
            </p>
          </div>
          <Button asChild className="cursor-pointer">
            <Link href="/comms/pub-form/new">
              <Plus className="h-4 w-4" />
              New form
            </Link>
          </Button>
        </div>

        <CommsViewToggle active={activeView} />
      </CommsPanel>

      {activeView === "board" ? (
        <CommsPanel>
          <AuthorReviewBoard
            approvals={approvals}
            reviews={reviews}
            currentUserId={currentUserId}
          />
        </CommsPanel>
      ) : activeView === "reviewing" ? (
        <CommsPanel>
          <ReviewerBoard
            approvals={approvals}
            reviews={reviews}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        </CommsPanel>
      ) : (
        <CommsPanel bodyClassName="px-2 pt-1 pb-2 sm:px-3">
          <PreReleaseStatusTabs
            active={active}
            author={authorId}
            counts={
              Object.fromEntries(
                APPROVAL_STATUS_FILTERS.map((f) => [
                  f,
                  byAuthor.filter((a) => matches(a, f)).length,
                ]),
              ) as Record<ApprovalStatusFilter, number>
            }
          />

          <PreReleaseList
            approvals={visible}
            authors={authors}
            activeAuthor={authorId}
            reviews={reviews}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            isAdmin={role === "admin" || role === "dev"}
            isDev={role === "dev"}
            emptyMessage={
              active === "all"
                ? "No pre-release forms submitted yet."
                : `No ${APPROVAL_STATUS_LABELS[active].toLowerCase()} forms.`
            }
          />
        </CommsPanel>
      )}
    </div>
  );
}
