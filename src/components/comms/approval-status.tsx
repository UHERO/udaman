import type { ApprovalJSON } from "@catalog/models/approval";
import { CheckCircle2, CircleDashed, Rocket } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Compact status badges for a pre-release form: review progress and
 * released state. Shared by the list and detail pages so they agree.
 */
export function ApprovalStatusBadges({
  approval,
  size = "sm",
}: {
  approval: Pick<
    ApprovalJSON,
    "reviewCount" | "requiredReviews" | "isReviewed" | "isReleased"
  >;
  size?: "sm" | "md";
}) {
  const cls = size === "md" ? "text-sm px-2.5 py-1" : "";
  return (
    <div className="flex flex-wrap gap-1.5">
      {approval.isReviewed ? (
        <Badge
          variant="outline"
          className={`border-emerald-600/40 text-emerald-700 dark:text-emerald-400 ${cls}`}
        >
          <CheckCircle2 />
          Reviewed
        </Badge>
      ) : (
        <Badge variant="outline" className={`text-muted-foreground ${cls}`}>
          <CircleDashed />
          {approval.reviewCount}/{approval.requiredReviews} reviews
        </Badge>
      )}
      {approval.isReleased && (
        <Badge variant="secondary" className={cls}>
          <Rocket />
          Released
        </Badge>
      )}
    </div>
  );
}
