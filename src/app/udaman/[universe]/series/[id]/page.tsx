import type { Universe } from "@catalog/types/shared";

import {
  getFormOptions,
  getSeriesById,
  getSourceMap,
} from "@/actions/series-actions";
import { LoaderSection } from "@/components/series/data-loader";
import { MetaDataTable } from "@/components/series/meta-data-table";
import { SeriesActionsBar } from "@/components/series/series-actions-bar";
import { SeriesChart } from "@/components/series/series-chart";
import { SeriesHoverProvider } from "@/components/series/series-data-section";
import { SeriesDataTable } from "@/components/series/series-table";
import { RecordSeriesView } from "@/components/series/record-series-view";
import { SourceMapTable } from "@/components/series/source-map";

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ universe: string; id: number }>;
}) {
  const { universe, id } = await params;
  const u = universe as Universe;
  const series = await getSeriesById(id, { universe: u });

  const { dataPoints, metadata, measurement, aliases, loaders } = series;

  const [sourceMap, formOptions] = await Promise.all([
    getSourceMap(id, { name: metadata.s_name }),
    getFormOptions({ universe: u }),
  ]);

  return (
    <div className="">
      <RecordSeriesView
        id={id}
        name={metadata.s_name}
        universe={universe}
        description={metadata.s_description}
        dataPortalName={metadata.s_dataPortalName}
      />
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
                unitShortLabel: metadata.u_short_label,
              }}
            />
          </div>
          <div className="sticky top-4 col-span-4 self-start rounded">
            <MetaDataTable metadata={{ ...metadata, measurement, aliases }} />
            <SeriesActionsBar
              seriesId={id}
              metadata={metadata}
              formOptions={formOptions}
            />
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
