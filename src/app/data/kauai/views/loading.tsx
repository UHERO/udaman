import { PortalCard } from "@/app/data/[universe]/components/ui/portal-card";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder in the dashboard's shape while the server fetches series. */
export function KauaiLoading() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 rounded-none" />
          <Skeleton className="h-3 w-40 rounded-none" />
        </div>
        <Skeleton className="h-8 w-64 rounded-none" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <PortalCard className="p-4 lg:col-span-7">
          <Skeleton className="h-[360px] w-full rounded-none" />
        </PortalCard>
        <PortalCard className="p-4 lg:col-span-5">
          <Skeleton className="h-[360px] w-full rounded-none" />
        </PortalCard>
      </div>
      <PortalCard className="space-y-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-none" />
        ))}
      </PortalCard>
    </div>
  );
}
