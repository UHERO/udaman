import type { ApprovalJSON } from "@catalog/models/approval";
import { CheckCircle2, CircleDashed, Rocket } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Status for a pre-release form: review progress and released state. Shared
 * by the list (badges) and detail page (`variant="text"`, plain inline text
 * so it isn't mistaken for the toggle buttons beside it) so they agree. The
 * list shows one badge: once released, "Released" replaces review progress.
 */
export function ApprovalStatusBadges({
  approval,
  variant = "badge",
}: {
  approval: Pick<
    ApprovalJSON,
    | "reviewCount"
    | "requiredReviews"
    | "isReviewed"
    | "isSuperReviewed"
    | "isReleased"
  >;
  variant?: "badge" | "text";
}) {
  if (variant === "text") {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {approval.isReviewed ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Reviewed
            {approval.isSuperReviewed && ` (${approval.reviewCount})`}
          </span>
        ) : (
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <CircleDashed className="h-4 w-4" />
            {approval.reviewCount}/{approval.requiredReviews} reviews
          </span>
        )}
        {approval.isReleased && (
          <span className="text-ublue inline-flex items-center gap-1">
            <Rocket className="h-4 w-4" />
            Released
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {approval.isReleased ? (
        <Badge variant="secondary">
          <Rocket />
          Released
        </Badge>
      ) : approval.isReviewed ? (
        <Badge
          variant="outline"
          className="border-emerald-600/40 text-emerald-700 dark:text-emerald-400"
          title={
            approval.isSuperReviewed
              ? `Marked reviewed with ${approval.reviewCount} of ${approval.requiredReviews} reviews`
              : undefined
          }
        >
          <CheckCircle2 />
          Reviewed
          {/* Marked by hand: show how many reviews it actually has. */}
          {approval.isSuperReviewed && ` (${approval.reviewCount})`}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          <CircleDashed />
          {approval.reviewCount}/{approval.requiredReviews} reviews
        </Badge>
      )}
    </div>
  );
}
