"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateMeasurementPayload,
  UpdateMeasurementPayload,
} from "@catalog/collections/measurement-collection";
import {
  createMeasurement as createMeasurementCtrl,
  deleteMeasurement as deleteMeasurementCtrl,
  getMeasurementsWithUnits as fetchMeasurements,
  updateMeasurement as updateMeasurementCtrl,
} from "@catalog/controllers/measurements";
import type { Universe } from "@catalog/types/shared";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("action.measurements");

export async function getMeasurements(params?: { universe?: Universe }) {
  log.info({ universe: params?.universe }, "getMeasurements action called");
  const result = await fetchMeasurements({ u: params?.universe });
  log.info({ count: result.data.length }, "getMeasurements action completed");
  return result.data;
}

export async function createMeasurement(payload: CreateMeasurementPayload) {
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
  log.info({ id }, "updateMeasurement action called");
  const result = await updateMeasurementCtrl({ id, payload });
  revalidatePath("/measurement");
  return { message: result.message, data: result.data.toJSON() };
}

export async function deleteMeasurement(id: number) {
  log.info({ id }, "deleteMeasurement action called");
  const result = await deleteMeasurementCtrl({ id });
  revalidatePath("/measurement");
  log.info({ id }, "deleteMeasurement action completed");
  return { message: result.message };
}
