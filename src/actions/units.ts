"use server";

import { revalidatePath } from "next/cache";
import { createLogger } from "@/core/observability/logger";
import {
  getUnits as fetchUnits,
  createUnit as createUnitCtrl,
  updateUnit as updateUnitCtrl,
  deleteUnit as deleteUnitCtrl,
} from "@catalog/controllers/units";
import type { CreateUnitPayload, UpdateUnitPayload } from "@catalog/collections/unit-collection";
import type { Universe } from "@catalog/types/shared";

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
  return result.data.toJSON();
}

export async function updateUnit(id: number, payload: UpdateUnitPayload) {
  log.info({ id }, "updateUnit action called");
  const result = await updateUnitCtrl({ id, payload });
  revalidatePath("/units");
  return result.data.toJSON();
}

export async function deleteUnit(id: number): Promise<void> {
  log.info({ id }, "deleteUnit action called");
  await deleteUnitCtrl({ id });
  revalidatePath("/units");
  log.info({ id }, "deleteUnit action completed");
}
