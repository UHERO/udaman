import { createLogger } from "@/core/observability/logger";
import type { Universe } from "../types/shared";
import MeasurementCollection from "../collections/measurement-collection";
import type { CreateMeasurementPayload, UpdateMeasurementPayload } from "../collections/measurement-collection";

const log = createLogger("catalog.measurements");

/*************************************************************************
 * MEASUREMENTS Controller
 *************************************************************************/

export async function getMeasurements({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching measurements");
  const data = await MeasurementCollection.list({ universe: u });
  log.info({ count: data.length }, "measurements fetched");
  return { data };
}

export async function getMeasurementsWithUnits({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching measurements with units");
  const data = await MeasurementCollection.listWithUnits({ universe: u });
  log.info({ count: data.length }, "measurements with units fetched");
  return { data };
}

export async function getMeasurement({ id }: { id: number }) {
  log.info({ id }, "fetching measurement");
  const data = await MeasurementCollection.getById(id);
  return { data };
}

export async function getMeasurementByPrefix({ prefix, universe }: { prefix: string; universe?: Universe }) {
  log.info({ prefix, universe }, "fetching measurement by prefix");
  const data = await MeasurementCollection.getByPrefix(prefix, universe);
  return { data };
}

export async function getMeasurementSeriesIds({ id }: { id: number }) {
  log.info({ id }, "fetching measurement series IDs");
  const data = await MeasurementCollection.getSeriesIds(id);
  log.info({ count: data.length }, "measurement series IDs fetched");
  return { data };
}

export async function addMeasurementSeries({ measurementId, seriesId }: { measurementId: number; seriesId: number }) {
  log.info({ measurementId, seriesId }, "adding series to measurement");
  await MeasurementCollection.addSeries(measurementId, seriesId);
  log.info({ measurementId, seriesId }, "series added to measurement");
}

export async function removeMeasurementSeries({ measurementId, seriesId }: { measurementId: number; seriesId: number }) {
  log.info({ measurementId, seriesId }, "removing series from measurement");
  await MeasurementCollection.removeSeries(measurementId, seriesId);
  log.info({ measurementId, seriesId }, "series removed from measurement");
}

export async function createMeasurement({ payload }: { payload: CreateMeasurementPayload }) {
  log.info({ payload }, "creating measurement");
  const data = await MeasurementCollection.create(payload);
  log.info({ id: data.id }, "measurement created");
  return { data };
}

export async function updateMeasurement({ id, payload }: { id: number; payload: UpdateMeasurementPayload }) {
  log.info({ id, payload }, "updating measurement");
  const data = await MeasurementCollection.update(id, payload);
  log.info({ id }, "measurement updated");
  return { data };
}

export async function deleteMeasurement({ id }: { id: number }) {
  log.info({ id }, "deleting measurement");
  await MeasurementCollection.delete(id);
  log.info({ id }, "measurement deleted");
}
