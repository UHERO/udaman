"use server";

import { revalidatePath } from "next/cache";
import { AppLogCollection } from "@catalog/collections/app-log-collection";
import type {
  CreateMeasurementPayload,
  UpdateMeasurementPayload,
} from "@catalog/collections/measurement-collection";
import {
  addMeasurementSeries as addMeasurementSeriesCtrl,
  createMeasurement as createMeasurementCtrl,
  deleteMeasurement as deleteMeasurementCtrl,
  getMeasurementsWithUnits as fetchMeasurements,
  getMeasurementSeriesWithMetadata as getMeasurementSeriesCtrl,
  getMeasurementWithLabels as getMeasurementWithLabelsCtrl,
  propagateFields as propagateFieldsCtrl,
  removeMeasurementSeries as removeMeasurementSeriesCtrl,
  updateMeasurement as updateMeasurementCtrl,
} from "@catalog/controllers/measurements";
import type { Universe } from "@catalog/types/shared";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.measurements");

export async function getMeasurements(params?: { universe?: Universe }) {
  await requirePermission("measurement", "read");
  log.info({ universe: params?.universe }, "getMeasurements action called");
  const result = await fetchMeasurements({ u: params?.universe });
  log.info({ count: result.data.length }, "getMeasurements action completed");
  return result.data;
}

export async function createMeasurement(payload: CreateMeasurementPayload) {
  const { userId } = await requirePermission("measurement", "create");
  log.info("createMeasurement action called");
  try {
    const result = await createMeasurementCtrl({ payload });
    revalidatePath("/measurement");
    log.info({ id: result.data.id }, "createMeasurement action completed");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createMeasurement failed");
    AppLogCollection.logError(err, { userId, name: "measurement.create" });
    throw err;
  }
}

export async function updateMeasurement(
  id: number,
  payload: UpdateMeasurementPayload,
) {
  const { userId } = await requirePermission("measurement", "update");
  log.info({ id }, "updateMeasurement action called");
  try {
    const result = await updateMeasurementCtrl({ id, payload });
    revalidatePath("/measurement");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateMeasurement failed");
    AppLogCollection.logError(err, { userId, name: "measurement.update" });
    throw err;
  }
}

export async function getMeasurementDetail(id: number) {
  await requirePermission("measurement", "read");
  log.info({ id }, "getMeasurementDetail action called");
  const { data: measurement } = await getMeasurementWithLabelsCtrl({ id });
  const { data: series } = await getMeasurementSeriesCtrl({ id });
  return { measurement, series };
}

export async function propagateFieldsAction(
  measurementId: number,
  fieldNames: string[],
  seriesNames: string[],
) {
  const { userId } = await requirePermission("measurement", "update");
  log.info({ measurementId }, "propagateFieldsAction called");
  try {
    const result = await propagateFieldsCtrl({
      measurementId,
      fieldNames,
      seriesNames,
    });
    revalidatePath("/measurement");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "propagateFieldsAction failed");
    AppLogCollection.logError(err, {
      userId,
      name: "measurement.propagate_fields",
    });
    throw err;
  }
}

export async function addSeriesAction(
  measurementId: number,
  seriesName: string,
) {
  const { userId } = await requirePermission("measurement", "update");
  log.info({ measurementId, seriesName }, "addSeriesAction called");
  try {
    const { default: SeriesCollection } =
      await import("@catalog/collections/series-collection");
    const series = await SeriesCollection.getByName(seriesName);
    await addMeasurementSeriesCtrl({
      measurementId,
      seriesId: series.id!,
    });
    revalidatePath("/measurement");
    return { message: `Added ${seriesName}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "addSeriesAction failed");
    AppLogCollection.logError(err, { userId, name: "measurement.add_series" });
    throw err;
  }
}

export async function removeSeriesAction(
  measurementId: number,
  seriesId: number,
) {
  const { userId } = await requirePermission("measurement", "update");
  log.info({ measurementId, seriesId }, "removeSeriesAction called");
  try {
    await removeMeasurementSeriesCtrl({ measurementId, seriesId });
    revalidatePath("/measurement");
    return { message: "Series removed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "removeSeriesAction failed");
    AppLogCollection.logError(err, {
      userId,
      name: "measurement.remove_series",
    });
    throw err;
  }
}

export async function deleteMeasurement(id: number) {
  const { userId } = await requirePermission("measurement", "delete");
  log.info({ id }, "deleteMeasurement action called");
  try {
    const result = await deleteMeasurementCtrl({ id });
    revalidatePath("/measurement");
    log.info({ id }, "deleteMeasurement action completed");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteMeasurement failed");
    AppLogCollection.logError(err, { userId, name: "measurement.delete" });
    throw err;
  }
}
