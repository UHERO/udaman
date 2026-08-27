"use server";

import { revalidatePath } from "next/cache";
import { AppLogCollection } from "@catalog/collections/app-log-collection";
import type {
  CreateGeographyPayload,
  UpdateGeographyPayload,
} from "@catalog/collections/geography-collection";
import {
  createGeography as createGeographyCtrl,
  deleteGeography as deleteGeographyCtrl,
  getGeographies as fetchGeographies,
  updateGeography as updateGeographyCtrl,
} from "@catalog/controllers/geographies";
import type { Geography, Universe } from "@catalog/types/shared";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.geographies");

export async function getGeographies(params?: {
  universe?: Universe;
}): Promise<Geography[]> {
  await requirePermission("geography", "read");
  log.info({ universe: params?.universe }, "getGeographies action called");
  const result = await fetchGeographies({ u: params?.universe });
  log.info({ count: result.data.length }, "getGeographies action completed");
  return result.data.map((g) => g.toJSON());
}

export async function createGeography(
  payload: CreateGeographyPayload,
): Promise<{ message: string; data: Geography }> {
  const { userId } = await requirePermission("geography", "create");
  log.info("createGeography action called");
  try {
    const result = await createGeographyCtrl({ payload });
    revalidatePath("/geographies");
    log.info({ id: result.data.id }, "createGeography action completed");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createGeography failed");
    AppLogCollection.logError(err, { userId, name: "geography.create" });
    throw err;
  }
}

export async function updateGeography(
  id: number,
  payload: UpdateGeographyPayload,
): Promise<{ message: string; data: Geography }> {
  const { userId } = await requirePermission("geography", "update");
  log.info({ id }, "updateGeography action called");
  try {
    const result = await updateGeographyCtrl({ id, payload });
    revalidatePath("/geographies");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateGeography failed");
    AppLogCollection.logError(err, { userId, name: "geography.update" });
    throw err;
  }
}

export async function deleteGeography(
  id: number,
): Promise<{ message: string }> {
  const { userId } = await requirePermission("geography", "delete");
  log.info({ id }, "deleteGeography action called");
  try {
    const result = await deleteGeographyCtrl({ id });
    revalidatePath("/geographies");
    log.info({ id }, "deleteGeography action completed");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteGeography failed");
    AppLogCollection.logError(err, { userId, name: "geography.delete" });
    throw err;
  }
}
