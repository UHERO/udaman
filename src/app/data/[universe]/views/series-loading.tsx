import { Skeleton } from "@/components/ui/skeleton";

import { PortalCard } from "../components/ui/portal-card";

/**
 * Route-level loading UI for the series page (series/loading.tsx). Shown
 * the moment a series link is clicked, while the server fetches the
 * package — mirrors the page's layout so nothing jumps when it arrives.
 */
export function SeriesLoading() {
  return (
    <div
      className="mx-auto flex max-w-6xl flex-col gap-4"
      aria-busy="true"
      aria-label="Loading series"
    >
      <PortalCard>
        <div className="space-y-2 px-4 pt-4 pb-3 md:px-5">
          <Skeleton className="h-7 w-2/3 max-w-xl rounded-none" />
          <Skeleton className="h-3 w-64 rounded-none" />
        </div>
        <div className="border-border flex flex-wrap items-center gap-3 border-t px-4 py-2.5 md:px-5">
          <Skeleton className="h-8 w-36 rounded-none" />
          <Skeleton className="h-8 w-36 rounded-none" />
          <Skeleton className="h-7 w-40 rounded-none" />
          <Skeleton className="h-7 w-48 rounded-none" />
          <Skeleton className="ml-auto h-8 w-24 rounded-none" />
        </div>
        <div className="px-4 pt-3 pb-4 md:px-5">
          <Skeleton className="h-[320px] w-full rounded-none" />
        </div>
      </PortalCard>
      <PortalCard className="space-y-2 p-4">
        <Skeleton className="h-4 w-40 rounded-none" />
        <Skeleton className="h-16 w-full rounded-none" />
      </PortalCard>
    </div>
  );
}
