import { getSeriesById, getSourceMap } from "@/actions/series-actions";
import { Universe } from "@catalog/types/shared";

import { LoaderSection } from "@/components/series/data-loader";
import { MetaDataTable } from "@/components/series/meta-data-table";
import { SeriesChart } from "@/components/series/series-chart";
import { SeriesHoverProvider } from "@/components/series/series-data-section";
import { SeriesDataTable } from "@/components/series/series-table";
import { SourceMapTable } from "@/components/series/source-map";

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ universe: Universe; id: number }>;
}) {
  const { universe, id } = await params;
  const series = await getSeriesById(id, { universe });

  const { dataPoints, metadata, measurement, aliases, loaders } = series;

  const sourceMap = await getSourceMap(id, { name: metadata.s_name });

  return (
    <div className="">
      <SeriesHoverProvider xseriesId={metadata.xs_id}>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-1 rounded"></div>
          <div className="col-span-6 rounded">
            <LoaderSection
              universe={universe}
              seriesId={id}
              loaders={loaders}
            />
            <SeriesDataTable
              data={dataPoints}
              options={{
                decimals: metadata.s_decimals,
                showLoaderCol: loaders.length > 1,
                xseriesId: metadata.xs_id,
                universe,
                seriesId: id,
              }}
            />
          </div>
          <div className="sticky top-4 col-span-4 self-start rounded">
            <MetaDataTable metadata={{ ...metadata, measurement, aliases }} />
            <SeriesChart data={dataPoints} />
          </div>
        </div>
      </SeriesHoverProvider>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-11 col-start-2">
          <SourceMapTable data={sourceMap} universe={universe} />
        </div>
      </div>
    </div>
  );
}
