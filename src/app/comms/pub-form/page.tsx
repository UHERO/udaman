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

import { getApprovals } from "@/actions/approvals";
import { PreReleaseList } from "@/components/comms/pre-release-list";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/dal";
import { cn } from "@/lib/utils";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [approvals, { userId, role }, { status }] = await Promise.all([
    getApprovals(),
    getCurrentUserContext(),
    searchParams,
  ]);
  const active: ApprovalStatusFilter = isApprovalStatusFilter(status)
    ? status
    : "all";
  const visible = approvals.filter((a) => matches(a, active));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pre-Release Form</h1>
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

      {/* Filters live in the URL so a view can be bookmarked or shared. */}
      <nav
        aria-label="Filter by status"
        className="flex flex-wrap gap-1 border-b"
      >
        {APPROVAL_STATUS_FILTERS.map((f) => {
          const count = approvals.filter((a) => matches(a, f)).length;
          const isActive = f === active;
          return (
            <Link
              key={f}
              href={
                f === "all" ? "/comms/pub-form" : `/comms/pub-form?status=${f}`
              }
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-foreground text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {APPROVAL_STATUS_LABELS[f]}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  isActive ? "bg-foreground/10" : "bg-muted",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      <PreReleaseList
        approvals={visible}
        currentUserId={parseInt(userId) || 0}
        isAdmin={role === "admin" || role === "dev"}
        emptyMessage={
          active === "all"
            ? "No pre-release forms submitted yet."
            : `No ${APPROVAL_STATUS_LABELS[active].toLowerCase()} forms.`
        }
      />
    </div>
  );
}
