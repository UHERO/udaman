import { notFound } from "next/navigation";
import { getSeriesById, getSourceMap } from "@/actions/series-actions";
import { Universe } from "@shared/types/shared";

import { LoaderSection } from "@/components/series/data-loader";
import { MetaDataTable } from "@/components/series/meta-data-table";
import { SeriesDataTable } from "@/components/series/series-table";
import { SourceMapTable } from "@/components/series/source-map";

export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: { id: number };
  searchParams: { u: Universe | undefined };
}) {
  const { id } = await params;
  const { u } = await searchParams;
  const series = await getSeriesById(id, { universe: u || "UHERO" });

  if (series.data === null) return notFound();
  const { dataPoints, metadata, measurement, aliases, loaders } = series.data;

  const sourceMap = await getSourceMap(id, { name: metadata.s_name });

  if (sourceMap.data === null) return notFound();
  return (
    <div className="">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-1 rounded"></div>
        <div className="col-span-7 rounded">
          <LoaderSection seriesId={id} loaders={loaders} />
          <SeriesDataTable
            data={dataPoints}
            options={{
              decimals: metadata.s_decimals,
              showLoaderCol: loaders.length > 1,
            }}
          />
          {/* <SourceMapTable seriesId={id} nodes={sourceMap.data} /> */}
        </div>
        <div className="col-span-4 rounded">
          <MetaDataTable metadata={{ ...metadata, measurement, aliases }} />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-11 col-start-2">
          <SourceMapTable data={sourceMap.data} />
        </div>
      </div>
    </div>
  );
}
