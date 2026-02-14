"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateUnitPayload,
  UpdateUnitPayload,
} from "@catalog/collections/unit-collection";
import {
  createUnit as createUnitCtrl,
  deleteUnit as deleteUnitCtrl,
  getUnits as fetchUnits,
  updateUnit as updateUnitCtrl,
} from "@catalog/controllers/units";
import type { Universe } from "@catalog/types/shared";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("action.units");

export async function getUnits(params?: { universe?: Universe }) {
  log.info({ universe: params?.universe }, "getUnits action called");
  const result = await fetchUnits({ u: params?.universe });
  log.info({ count: result.data.length }, "getUnits action completed");
  return result.data.map((u) => u.toJSON());
}

export async function createUnit(payload: CreateUnitPayload) {
  log.info("createUnit action called");
  const result = await createUnitCtrl({ payload });
  revalidatePath("/units");
  log.info({ id: result.data.id }, "createUnit action completed");
  return { message: result.message, data: result.data.toJSON() };
}

export async function updateUnit(id: number, payload: UpdateUnitPayload) {
  log.info({ id }, "updateUnit action called");
  const result = await updateUnitCtrl({ id, payload });
  revalidatePath("/units");
  return { message: result.message, data: result.data.toJSON() };
}

export async function deleteUnit(id: number) {
  log.info({ id }, "deleteUnit action called");
  const result = await deleteUnitCtrl({ id });
  revalidatePath("/units");
  log.info({ id }, "deleteUnit action completed");
  return { message: result.message };
}
