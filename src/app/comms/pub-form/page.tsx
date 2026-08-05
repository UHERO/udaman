import Link from "next/link";
import { Plus } from "lucide-react";

import { getApprovals } from "@/actions/approvals";
import { PreReleaseList } from "@/components/comms/pre-release-list";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/dal";

export default async function Page() {
  const [approvals, { userId, role }] = await Promise.all([
    getApprovals(),
    getCurrentUserContext(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pre-Release Form</h1>
          <p className="text-muted-foreground text-sm">
            Sign-off record filed by the lead author before a work product is
            released.
          </p>
        </div>
        <Button asChild className="cursor-pointer">
          <Link href="/comms/pub-form/new">
            <Plus className="h-4 w-4" />
            New form
          </Link>
        </Button>
      </div>

      <PreReleaseList
        approvals={approvals}
        currentUserId={parseInt(userId) || 0}
        isAdmin={role === "admin" || role === "dev"}
      />
    </div>
  );
}
