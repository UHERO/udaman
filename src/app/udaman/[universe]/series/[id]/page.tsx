import type { Universe } from "@catalog/types/shared";

import {
  getFormOptions,
  getSeriesById,
  getSeriesDependents,
  getSourceMap,
} from "@/actions/series-actions";
import { getLoaderActions } from "@/actions/loader-actions";
import { LoaderSection } from "@/components/series/data-loader";
import { DependentsList } from "@/components/series/dependents-list";
import { MetaDataTable } from "@/components/series/meta-data-table";
import { RecordSeriesView } from "@/components/series/record-series-view";
import { LoaderActionHistory } from "@/components/series/loader-action-history";
import { SeriesActionsBar } from "@/components/series/series-actions-bar";
import { SeriesChart } from "@/components/series/series-chart";
import { SeriesHoverProvider } from "@/components/series/series-data-section";
import { SeriesDataTable } from "@/components/series/series-table";
import { SourceMapTable } from "@/components/series/source-map";
import { getCurrentUserRole } from "@/lib/auth/dal";

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ universe: string; id: number }>;
}) {
  const { universe, id } = await params;
  const u = universe as Universe;
  const [series, role] = await Promise.all([
    getSeriesById(id, { universe: u }),
    getCurrentUserRole(),
  ]);

  const { dataPoints, metadata, measurement, aliases, loaders } = series;
  const isDev = role === "dev";

  const [sourceMap, formOptions, dependents, loaderActions] = await Promise.all([
    getSourceMap(id, { name: metadata.s_name }),
    getFormOptions({ universe: u }),
    getSeriesDependents({ name: metadata.s_name, universe: u }),
    getLoaderActions(id),
  ]);

  return (
    <div>
      <RecordSeriesView
        id={id}
        name={metadata.s_name ?? ""}
        universe={universe}
        description={metadata.s_description}
        dataPortalName={metadata.s_dataPortalName}
      />
      <SeriesHoverProvider xseriesId={metadata.xs_id}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(320px,400px)]">
          <div className="min-w-0">
            <LoaderSection
              universe={universe}
              seriesId={id}
              loaders={loaders}
            />
            <LoaderActionHistory actions={loaderActions} />
            <SeriesDataTable
              data={dataPoints}
              options={{
                decimals: metadata.s_decimals ?? 1,
                showLoaderCol: loaders.length > 1,
                xseriesId: metadata.xs_id,
                universe,
                seriesId: id,
              }}
            />
          </div>
          <div className="sticky top-4 self-start">
            <MetaDataTable
              metadata={{ ...metadata, measurement, aliases }}
              universe={universe}
              isDev={isDev}
            />
            <SeriesActionsBar
              seriesId={id}
              metadata={metadata}
              formOptions={formOptions}
            />
            <SeriesChart data={dataPoints} />
            <DependentsList dependents={dependents} universe={universe} />
          </div>
        </div>
      </SeriesHoverProvider>
      <SourceMapTable data={sourceMap} universe={universe} />
    </div>
  );
}
