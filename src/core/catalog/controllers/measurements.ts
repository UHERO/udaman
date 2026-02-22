import "server-only";

import { createLogger } from "@/core/observability/logger";

import MeasurementCollection from "../collections/measurement-collection";
import type {
  CreateMeasurementPayload,
  UpdateMeasurementPayload,
} from "../collections/measurement-collection";
import SeriesCollection from "../collections/series-collection";
import type { UpdateSeriesPayload } from "../collections/series-collection";
import type { Universe } from "../types/shared";

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

export async function getMeasurementWithLabels({ id }: { id: number }) {
  log.info({ id }, "fetching measurement with labels");
  const data = await MeasurementCollection.getByIdWithLabels(id);
  return { data };
}

export async function getMeasurementByPrefix({
  prefix,
  universe,
}: {
  prefix: string;
  universe?: Universe;
}) {
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

export async function addMeasurementSeries({
  measurementId,
  seriesId,
}: {
  measurementId: number;
  seriesId: number;
}) {
  log.info({ measurementId, seriesId }, "adding series to measurement");
  await MeasurementCollection.addSeries(measurementId, seriesId);
  log.info({ measurementId, seriesId }, "series added to measurement");
}

export async function removeMeasurementSeries({
  measurementId,
  seriesId,
}: {
  measurementId: number;
  seriesId: number;
}) {
  log.info({ measurementId, seriesId }, "removing series from measurement");
  await MeasurementCollection.removeSeries(measurementId, seriesId);
  log.info({ measurementId, seriesId }, "series removed from measurement");
}

export async function createMeasurement({
  payload,
}: {
  payload: CreateMeasurementPayload;
}) {
  log.info({ payload }, "creating measurement");
  const data = await MeasurementCollection.create(payload);
  log.info({ id: data.id }, "measurement created");
  return { message: "Measurement created", data };
}

export async function updateMeasurement({
  id,
  payload,
}: {
  id: number;
  payload: UpdateMeasurementPayload;
}) {
  log.info({ id, payload }, "updating measurement");
  const data = await MeasurementCollection.update(id, payload);
  log.info({ id }, "measurement updated");
  return { message: "Measurement updated", data };
}

export async function getMeasurementSeriesWithMetadata({ id }: { id: number }) {
  log.info({ id }, "fetching measurement series with metadata");
  const data = await MeasurementCollection.getSeriesWithMetadata(id);
  log.info({ count: data.length }, "measurement series with metadata fetched");
  return { data };
}

/** Propagatable field names that map from measurement to series */
const PROPAGATABLE_FIELDS = [
  "dataPortalName",
  "unitId",
  "sourceId",
  "sourceDetailId",
  "sourceLink",
  "seasonalAdjustment",
  "percent",
  "real",
  "decimals",
  "frequencyTransform",
  "restricted",
] as const;

type PropagatableField = (typeof PROPAGATABLE_FIELDS)[number];

export async function propagateFields({
  measurementId,
  fieldNames,
  seriesNames,
}: {
  measurementId: number;
  fieldNames: string[];
  seriesNames: string[];
}) {
  log.info(
    {
      measurementId,
      fieldCount: fieldNames.length,
      seriesCount: seriesNames.length,
    },
    "propagating measurement fields to series",
  );

  const measurement = await MeasurementCollection.getById(measurementId);

  // Build the update payload from selected measurement fields
  const updatePayload: UpdateSeriesPayload = {};
  for (const field of fieldNames) {
    if (!PROPAGATABLE_FIELDS.includes(field as PropagatableField)) {
      log.warn({ field }, "skipping unknown propagatable field");
      continue;
    }
    const key = field as PropagatableField;
    const value = measurement[key];
    (updatePayload as Record<string, unknown>)[key] = value;
  }

  if (Object.keys(updatePayload).length === 0) {
    return { message: "No valid fields selected for propagation" };
  }

  let updatedCount = 0;
  for (const name of seriesNames) {
    try {
      const series = await SeriesCollection.getByName(name);
      await SeriesCollection.update(series.id!, updatePayload);
      updatedCount++;
    } catch (e) {
      log.warn({ name, error: e }, "failed to propagate to series");
    }
  }

  const message = `Propagated ${fieldNames.length} field(s) to ${updatedCount} series`;
  log.info({ measurementId, updatedCount }, message);
  return { message };
}

export async function deleteMeasurement({ id }: { id: number }) {
  log.info({ id }, "deleting measurement");
  await MeasurementCollection.delete(id);
  log.info({ id }, "measurement deleted");
  return { message: "Measurement deleted" };
}
