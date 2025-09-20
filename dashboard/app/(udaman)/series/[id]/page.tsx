import { notFound } from "next/navigation";
import { getSeriesById, getSourceMap } from "@/actions/series-actions";

import { LoaderSection } from "@/components/series/data-loader";
import { MetaDataTable } from "@/components/series/meta-data-table";
import { SeriesDataTable } from "@/components/series/series-table";
import { SourceMapTable } from "@/components/series/source-map";

export default async function SeriesPage({
  params,
}: {
  params: { id: number };
}) {
  const { id } = await params;
  const { error, data } = await getSeriesById(id);
  if (error) throw error;
  if (data === null) return notFound();
  const { dataPoints, metadata, measurement, aliases, loaders } = data;

  const sourceMap = await getSourceMap(id, { name: metadata.s_name });
  if (sourceMap.error) throw error;
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
