"use server";

import { revalidatePath } from "next/cache";
import { createLogger } from "@/core/observability/logger";
import {
  getMeasurementsWithUnits as fetchMeasurements,
  createMeasurement as createMeasurementCtrl,
  updateMeasurement as updateMeasurementCtrl,
  deleteMeasurement as deleteMeasurementCtrl,
} from "@catalog/controllers/measurements";
import type { CreateMeasurementPayload, UpdateMeasurementPayload } from "@catalog/collections/measurement-collection";
import type { Universe } from "@catalog/types/shared";

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
  return result.data.toJSON();
}

export async function updateMeasurement(id: number, payload: UpdateMeasurementPayload) {
  log.info({ id }, "updateMeasurement action called");
  const result = await updateMeasurementCtrl({ id, payload });
  revalidatePath("/measurement");
  return result.data.toJSON();
}

export async function deleteMeasurement(id: number): Promise<void> {
  log.info({ id }, "deleteMeasurement action called");
  await deleteMeasurementCtrl({ id });
  revalidatePath("/measurement");
  log.info({ id }, "deleteMeasurement action completed");
}
