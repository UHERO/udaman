import { createLogger } from "@/core/observability/logger";
import { Universe } from "../types/shared";
import LoaderCollection from "@catalog/collections/loader-collection";
import DataPointCollection from "@catalog/collections/data-point-collection";
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
    DataPointCollection.getBySeriesId({ xseriesId: metadata.xs_id }),
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

export async function getSeriesWithNullField({
  universe,
  field,
  page,
  perPage,
}: {
  universe: string;
  field: string;
  page?: number;
  perPage?: number;
}) {
  log.info({ universe, field, page }, "fetching series with null field");
  const result = await SeriesCollection.getWithNullField(universe, field, page, perPage);
  log.info({ universe, field, totalCount: result.totalCount }, "series with null field fetched");
  return result;
}

export async function getQuarantinedSeries({
  universe,
  page,
  perPage,
}: {
  universe: string;
  page?: number;
  perPage?: number;
}) {
  log.info({ universe, page }, "fetching quarantined series");
  const result = await SeriesCollection.getQuarantined(universe, page, perPage);
  log.info({ universe, totalCount: result.totalCount }, "quarantined series fetched");
  return result;
}

export async function unquarantineSeries({ seriesId }: { seriesId: number }) {
  log.info({ seriesId }, "unquarantining series");
  await SeriesCollection.unquarantine(seriesId);
  log.info({ seriesId }, "series unquarantined");
}

export async function emptyQuarantine({ universe }: { universe: string }) {
  log.info({ universe }, "emptying quarantine");
  const count = await SeriesCollection.emptyQuarantine(universe);
  log.info({ universe, count }, "quarantine emptied");
  return count;
}

export async function updateSeries({
  id,
  payload,
}: {
  id: number;
  payload: import("@catalog/collections/series-collection").UpdateSeriesPayload;
}) {
  log.info({ id }, "updating series");
  const result = await SeriesCollection.update(id, payload);
  log.info({ id, name: result.name }, "series updated");
  return result;
}

export async function duplicateSeries({
  sourceId,
  payload,
  copyLoaders,
}: {
  sourceId: number;
  payload: import("@catalog/collections/series-collection").CreateSeriesPayload;
  copyLoaders: boolean;
}) {
  log.info({ sourceId, name: payload.name, copyLoaders }, "duplicating series");
  const newSeries = await SeriesCollection.create(payload);

  if (copyLoaders) {
    const loaders = await LoaderCollection.getEnabledBySeriesId(sourceId);
    for (const loader of loaders) {
      await LoaderCollection.create({
        seriesId: newSeries.id!,
        code: loader.eval ?? "",
        universe: payload.universe ?? "UHERO",
        priority: loader.priority,
        scale: Number(loader.scale) || 1,
        presaveHook: loader.presaveHook ?? "",
        clearBeforeLoad: loader.clearBeforeLoad,
        pseudoHistory: loader.pseudoHistory,
      });
    }
    log.info({ sourceId, newId: newSeries.id, loadersCopied: loaders.length }, "loaders copied");
  }

  log.info({ sourceId, newId: newSeries.id, name: newSeries.name }, "series duplicated");
  return newSeries;
}

export async function deleteSeries({
  id,
  force,
}: {
  id: number;
  force?: boolean;
}) {
  log.info({ id, force }, "deleting series");
  await SeriesCollection.delete(id, { force });
  log.info({ id }, "series deleted");
}

export async function searchSeries({term, universe="uhero", limit}:{term: string, universe: string; limit?: number}) {
  log.info({ term, universe, limit }, "search series");
  const results = await SeriesCollection.search({text: term, universe, limit});
  const ids = results.map((s) => s.id).filter((id): id is number => id !== null);
  const summaries = await SeriesCollection.getSummaryByIds(ids);
  log.info({ found: summaries.length }, "search series");
  return summaries;
}