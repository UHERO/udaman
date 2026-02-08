import { createLogger } from "@/core/observability/logger";
import { Universe } from "../types/shared";
import { DataLoaders } from "../models/data-loaders";
import DataPoints from "../models/data-points";
import Measurements from "../models/measurements";
import Series from "../models/series";

const log = createLogger("catalog.series");

/*************************************************************************
 * SERIES Controller
 *************************************************************************/

export async function getSeries({ offset, limit, universe }: { offset?: number; limit?: number; universe: Universe }) {
  log.info({ offset, limit, universe }, "fetching series summary list");
  const data = await Series.getSummaryList({ offset, limit, universe });
  log.info({ count: data.length, universe }, "series summary list fetched");
  return { data, offset, limit };
}

export async function getSeriesById({ id }: { id: number }) {
  log.info({ id }, "fetching series by id");

  // Fetch metadata first — we need xs_id for the data points query
  const metadata = await Series.getSeriesMetadata({ id });

  const [measurement, dataPoints, loaders] = await Promise.all([
    Measurements.getSeriesMeasurements({ seriesId: id }),
    DataPoints.getBySeriesId({ xseriesId: metadata.xs_id }),
    DataLoaders.getSeriesLoaders({ seriesId: id }),
  ]);

  const aliases = await Series.getAliases({
    sId: id,
    xsId: metadata.xs_id,
  });

  log.info({ id, dataPointCount: dataPoints.length }, "series fetched");

  return {
    data: {
      aliases,
      dataPoints,
      loaders,
      measurement,
      metadata,
    },
  };
}

export async function getSourceMap({ name }: { name: string }) {
  log.info({ name }, "fetching source map");
  const data = await DataLoaders.getDependencies({ seriesName: name });
  return { data };
}

export async function deleteSeriesDataPoints({ id, u, date, deleteBy }: {
  id: number;
  u: Universe;
  date?: string;
  deleteBy: "observationDate" | "vintageDate" | "none";
}) {
  log.info({ id, universe: u, deleteBy, date }, "deleting series data points");
  const data = await Series.deleteDataPoints({ id, u, date, deleteBy });
  log.info({ id, deleteBy }, "series data points deleted");
  return { data };
}
