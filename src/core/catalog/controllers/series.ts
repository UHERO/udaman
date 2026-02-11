import { createLogger } from "@/core/observability/logger";
import { Universe } from "../types/shared";
import LoaderCollection from "@catalog/collections/loader-collection";
import DataPoints from "../models/data-points";
import Measurements from "../models/measurements";
import SeriesCollection from "@catalog/collections/series-collection";

const log = createLogger("catalog.series");

/*************************************************************************
 * SERIES Controller
 *************************************************************************/

export async function getSeries({ offset, limit, universe }: { offset?: number; limit?: number; universe: Universe }) {
  log.info({ offset, limit, universe }, "fetching series summary list");
  const data = await SeriesCollection.getSummaryList({ offset, limit, universe });
  log.info({ count: data.length, universe }, "series summary list fetched");
  return { data, offset, limit };
}

export async function getSeriesById({ id }: { id: number }) {
  log.info({ id }, "fetching series by id");

  // Fetch metadata first — we need xs_id for the data points query
  const metadata = await SeriesCollection.getSeriesMetadata({ id });

  const [measurement, dataPoints, loaders] = await Promise.all([
    Measurements.getSeriesMeasurements({ seriesId: id }),
    DataPoints.getBySeriesId({ xseriesId: metadata.xs_id }),
    LoaderCollection.getBySeriesId(id),
  ]);

  const aliases = await SeriesCollection.getAliases({
    sId: id,
    xsId: metadata.xs_id,
  });

  log.info({ id, dataPointCount: dataPoints.length }, "series fetched");

  return {
    data: {
      aliases: aliases.map(d => d.toJSON()),
      dataPoints: dataPoints,
      loaders: loaders.map(d => d.toJSON()),
      measurement: measurement,
      metadata: metadata,
    },
  };
}

export async function getSourceMap({ name }: { name: string }) {
  log.info({ name }, "fetching source map");
  const data = await LoaderCollection.getDependencyTree(name);
  return { data };
}

export async function deleteSeriesDataPoints({ id, u, date, deleteBy }: {
  id: number;
  u: Universe;
  date?: string;
  deleteBy: "observationDate" | "vintageDate" | "none";
}) {
  log.info({ id, universe: u, deleteBy, date }, "deleting series data points");
  const data = await SeriesCollection.deleteDataPoints({ id, u, date, deleteBy });
  log.info({ id, deleteBy }, "series data points deleted");
  return { data };
}

export async function searchSeries({term, universe="uhero", limit}:{term: string, universe: string; limit?: number}) {
  log.info({ term, universe, limit }, "search series");
  const results = await SeriesCollection.search({text: term, universe, limit});
  const ids = results.map((s) => s.id).filter((id): id is number => id !== null);
  const summaries = await SeriesCollection.getSummaryByIds(ids);
  log.info({ found: summaries.length }, "search series");
  return summaries;
}