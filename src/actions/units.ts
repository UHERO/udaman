"use server";

import { revalidatePath } from "next/cache";
import { AppLogCollection } from "@catalog/collections/app-log-collection";
import type {
  CreateUnitPayload,
  UpdateUnitPayload,
} from "@catalog/collections/unit-collection";
import { getSeriesByCatalogRef } from "@catalog/controllers/series";
import {
  createUnit as createUnitCtrl,
  deleteUnit as deleteUnitCtrl,
  getUnit as fetchUnit,
  getUnits as fetchUnits,
  updateUnit as updateUnitCtrl,
} from "@catalog/controllers/units";
import type { Universe } from "@catalog/types/shared";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";
import type { SeriesPage } from "@/lib/series-page";

const log = createLogger("action.units");

export async function getUnits(params?: { universe?: Universe }) {
  await requirePermission("unit", "read");
  log.info({ universe: params?.universe }, "getUnits action called");
  const result = await fetchUnits({ u: params?.universe });
  log.info({ count: result.data.length }, "getUnits action completed");
  return result.data.map((u) => u.toJSON());
}

/** One unit plus the series that reference it (detail page). */
export async function getUnitDetail(id: number, { page, limit }: SeriesPage) {
  await requirePermission("unit", "read");
  log.info({ id }, "getUnitDetail action called");
  const [{ data: record }, { data: series }] = await Promise.all([
    fetchUnit({ id }),
    getSeriesByCatalogRef({ ref: "unit", id, page, limit }),
  ]);
  return { record: record.toJSON(), series: { ...series, page, limit } };
}

export async function createUnit(payload: CreateUnitPayload) {
  const { userId } = await requirePermission("unit", "create");
  log.info("createUnit action called");
  try {
    const result = await createUnitCtrl({ payload });
    revalidatePath("/units");
    log.info({ id: result.data.id }, "createUnit action completed");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createUnit failed");
    AppLogCollection.logError(err, { userId, name: "unit.create" });
    throw err;
  }
}

export async function updateUnit(id: number, payload: UpdateUnitPayload) {
  const { userId } = await requirePermission("unit", "update");
  log.info({ id }, "updateUnit action called");
  try {
    const result = await updateUnitCtrl({ id, payload });
    revalidatePath("/units");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateUnit failed");
    AppLogCollection.logError(err, { userId, name: "unit.update" });
    throw err;
  }
}

export async function deleteUnit(id: number) {
  const { userId } = await requirePermission("unit", "delete");
  log.info({ id }, "deleteUnit action called");
  try {
    const result = await deleteUnitCtrl({ id });
    revalidatePath("/units");
    log.info({ id }, "deleteUnit action completed");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteUnit failed");
    AppLogCollection.logError(err, { userId, name: "unit.delete" });
    throw err;
  }
}
