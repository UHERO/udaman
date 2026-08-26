import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import {
  getApproval,
  getApprovalReviews,
  getCanSelfReview,
  currentUserName as getCurrentUserName,
} from "@/actions/approvals";
import { ApprovalStatusBadges } from "@/components/comms/approval-status";
import { PreReleaseDetail } from "@/components/comms/pre-release-detail";
import { ReviewPanel } from "@/components/comms/review-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCurrentUserContext } from "@/lib/auth/dal";
import { NotFoundError } from "@/lib/errors";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const { userId, role } = await getCurrentUserContext();

  let approval;
  try {
    approval = await getApproval(numericId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [reviews, selfReview] = await Promise.all([
    getApprovalReviews(numericId),
    getCanSelfReview(),
  ]);
  const currentUserName = await getCurrentUserName();
  const currentUserId = parseInt(userId) || 0;
  const isAdmin = role === "admin" || role === "dev";

  // Only the author (or an admin) can revise a filed form.
  const canEdit = isAdmin || approval.authorUserId === currentUserId;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/comms"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All pre-release forms
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{approval.name}</h1>
          <p className="text-muted-foreground text-sm">
            Pre-release form filed by {approval.author}
          </p>
          <div className="mt-2">
            <ApprovalStatusBadges approval={approval} size="md" />
          </div>
        </div>
        {canEdit && (
          <Button asChild variant="outline" className="cursor-pointer">
            <Link href={`/comms/pub-form/${approval.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <ReviewPanel
        approval={approval}
        reviews={reviews}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        isAdmin={isAdmin}
        isDev={role === "dev"}
        canSelfReview={selfReview}
      />

      <Separator />

      <PreReleaseDetail approval={approval} />
    </div>
  );
}
