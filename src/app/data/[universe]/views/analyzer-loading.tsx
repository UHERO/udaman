import { Skeleton } from "@/components/ui/skeleton";

import { PortalCard } from "../components/ui/portal-card";

export function AnalyzerLoading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading analyzer">
      <PortalCard className="space-y-3 p-4">
        <Skeleton className="h-6 w-40 rounded-none" />
        <Skeleton className="h-8 w-full rounded-none" />
      </PortalCard>
      <PortalCard className="p-4">
        <Skeleton className="h-72 w-full rounded-none" />
      </PortalCard>
    </div>
  );
}
