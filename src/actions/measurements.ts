"use server";

import { revalidatePath } from "next/cache";
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
  log.info({ universe: params?.universe }, "getMeasurements action called");
  const result = await fetchMeasurements({ u: params?.universe });
  log.info({ count: result.data.length }, "getMeasurements action completed");
  return result.data;
}

export async function createMeasurement(payload: CreateMeasurementPayload) {
  await requirePermission("measurement", "create");
  log.info("createMeasurement action called");
  const result = await createMeasurementCtrl({ payload });
  revalidatePath("/measurement");
  log.info({ id: result.data.id }, "createMeasurement action completed");
  return { message: result.message, data: result.data.toJSON() };
}

export async function updateMeasurement(
  id: number,
  payload: UpdateMeasurementPayload,
) {
  await requirePermission("measurement", "update");
  log.info({ id }, "updateMeasurement action called");
  const result = await updateMeasurementCtrl({ id, payload });
  revalidatePath("/measurement");
  return { message: result.message, data: result.data.toJSON() };
}

export async function getMeasurementDetail(id: number) {
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
  await requirePermission("measurement", "update");
  log.info({ measurementId }, "propagateFieldsAction called");
  const result = await propagateFieldsCtrl({
    measurementId,
    fieldNames,
    seriesNames,
  });
  revalidatePath("/measurement");
  return { message: result.message };
}

export async function addSeriesAction(
  measurementId: number,
  seriesName: string,
) {
  await requirePermission("measurement", "update");
  log.info({ measurementId, seriesName }, "addSeriesAction called");
  const { default: SeriesCollection } =
    await import("@catalog/collections/series-collection");
  const series = await SeriesCollection.getByName(seriesName);
  await addMeasurementSeriesCtrl({
    measurementId,
    seriesId: series.id!,
  });
  revalidatePath("/measurement");
  return { message: `Added ${seriesName}` };
}

export async function removeSeriesAction(
  measurementId: number,
  seriesId: number,
) {
  await requirePermission("measurement", "update");
  log.info({ measurementId, seriesId }, "removeSeriesAction called");
  await removeMeasurementSeriesCtrl({ measurementId, seriesId });
  revalidatePath("/measurement");
  return { message: "Series removed" };
}

export async function deleteMeasurement(id: number) {
  await requirePermission("measurement", "delete");
  log.info({ id }, "deleteMeasurement action called");
  const result = await deleteMeasurementCtrl({ id });
  revalidatePath("/measurement");
  log.info({ id }, "deleteMeasurement action completed");
  return { message: result.message };
}
