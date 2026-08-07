import { notFound, redirect } from "next/navigation";

import { getApproval } from "@/actions/approvals";
import { PreReleaseForm } from "@/components/comms/pre-release-form";
import { PRE_RELEASE_RECIPIENTS } from "@/core/mailers/recipients";
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

  // The update action enforces this too; bounce to the read-only view rather
  // than rendering a form that can't be saved.
  const canEdit =
    role === "admin" ||
    role === "dev" ||
    approval.authorUserId === (parseInt(userId) || 0);
  if (!canEdit) redirect(`/comms/pub-form/${numericId}`);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Edit pre-release form</h1>
        <p className="text-muted-foreground text-sm">
          Saving re-certifies the form as of now. Recipients are notified on
          submission only, not on edits.
        </p>
      </div>
      <PreReleaseForm
        mode="edit"
        approval={approval}
        authorName={approval.author}
        standardRecipients={[...PRE_RELEASE_RECIPIENTS]}
      />
    </div>
  );
}
