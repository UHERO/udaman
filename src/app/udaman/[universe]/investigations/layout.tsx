import {
  getQuarantinedSeries,
  getSeriesWithNullField,
} from "@/actions/series-actions";
import { InvestigationsTabs } from "@/components/investigations/investigations-tabs";
import { SeriesLayout } from "@/components/series/series-layout";
import { getCurrentUserContext } from "@/lib/auth/dal";
import { getReadableResources } from "@/lib/auth/readable-resources";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const { role, universe: userUniverse } = await getCurrentUserContext();
  const readableResources = await getReadableResources(role);

  const [noSourceResult, quarantineResult] = await Promise.all([
    getSeriesWithNullField(universe, "source_id", 1, 1),
    getQuarantinedSeries(universe, 1, 1),
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-0 sm:p-4 sm:pt-0">
      <InvestigationsTabs
        role={role}
        readableResources={readableResources}
        universe={userUniverse}
        badgeCounts={{
          noSource: noSourceResult.totalCount,
          quarantine: quarantineResult.totalCount,
        }}
      />
      <SeriesLayout>{children}</SeriesLayout>
    </div>
  );
}
