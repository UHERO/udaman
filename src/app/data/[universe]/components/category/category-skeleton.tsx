import { Skeleton } from "@/components/ui/skeleton";

import { PortalCard } from "../ui/portal-card";

/** Loading placeholder for the landing / category page. */
export function CategorySkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading category">
      <Skeleton className="h-7 w-64 rounded-none" />
      <PortalCard className="flex flex-wrap items-center gap-3 px-4 py-3">
        <Skeleton className="h-8 w-40 rounded-none" />
        <Skeleton className="h-8 w-32 rounded-none" />
        <Skeleton className="h-8 w-28 rounded-none" />
        <Skeleton className="ml-auto h-8 w-80 max-w-full rounded-none" />
      </PortalCard>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
        {Array.from({ length: cards }, (_, i) => (
          <PortalCard key={i} className="space-y-2 p-4">
            <Skeleton className="h-4 w-3/4 rounded-none" />
            <Skeleton className="h-3 w-1/2 rounded-none" />
            <Skeleton className="h-3 w-2/5 rounded-none" />
            <Skeleton className="mt-3 h-28 w-full rounded-none" />
          </PortalCard>
        ))}
      </div>
    </div>
  );
}
