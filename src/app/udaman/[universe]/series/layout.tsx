import {
  getQuarantinedSeries,
  getSeriesWithNullField,
} from "@/actions/series-actions";
import { SeriesLayout } from "@/components/series/series-layout";
import { SeriesTabs } from "@/components/series/series-tabs";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;

  const [noSourceResult, quarantineResult] = await Promise.all([
    getSeriesWithNullField(universe, "source_id", 1, 1),
    getQuarantinedSeries(universe, 1, 1),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <SeriesTabs
        badgeCounts={{
          noSource: noSourceResult.totalCount,
          quarantine: quarantineResult.totalCount,
        }}
      />
      <SeriesLayout>{children}</SeriesLayout>
    </div>
  );
}
