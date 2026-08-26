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
  getCanSelfReview,
  currentUserName as getCurrentUserName,
} from "@/actions/approvals";
import { PreReleaseList } from "@/components/comms/pre-release-list";
import { PreReleaseStatusTabs } from "@/components/comms/pre-release-status-tabs";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/dal";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ approvals, reviews }, { userId, role }, { status }, selfReview] =
    await Promise.all([
      getApprovalsWithReviews(),
      getCurrentUserContext(),
      searchParams,
      getCanSelfReview(),
    ]);
  const currentUserName = await getCurrentUserName();
  const active: ApprovalStatusFilter = isApprovalStatusFilter(status)
    ? status
    : "all";
  const visible = approvals.filter((a) => matches(a, active));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pre-Release Forms</h1>
          <p className="text-muted-foreground text-sm">
            Sign-off record filed by the lead author before a work product is
            released. A form is reviewed once {REQUIRED_REVIEWS} colleagues have
            signed off.
          </p>
        </div>
        <Button asChild className="cursor-pointer">
          <Link href="/comms/pub-form/new">
            <Plus className="h-4 w-4" />
            New form
          </Link>
        </Button>
      </div>

      <PreReleaseStatusTabs
        active={active}
        counts={
          Object.fromEntries(
            APPROVAL_STATUS_FILTERS.map((f) => [
              f,
              approvals.filter((a) => matches(a, f)).length,
            ]),
          ) as Record<ApprovalStatusFilter, number>
        }
      />

      <PreReleaseList
        approvals={visible}
        reviews={reviews}
        currentUserId={parseInt(userId) || 0}
        currentUserName={currentUserName}
        isAdmin={role === "admin" || role === "dev"}
        isDev={role === "dev"}
        canSelfReview={selfReview}
        emptyMessage={
          active === "all"
            ? "No pre-release forms submitted yet."
            : `No ${APPROVAL_STATUS_LABELS[active].toLowerCase()} forms.`
        }
      />
    </div>
  );
}
