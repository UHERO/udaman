"use server";

import { revalidatePath } from "next/cache";
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
  log.info({ universe: params?.universe }, "getGeographies action called");
  const result = await fetchGeographies({ u: params?.universe });
  log.info({ count: result.data.length }, "getGeographies action completed");
  return result.data.map((g) => g.toJSON());
}

export async function createGeography(
  payload: CreateGeographyPayload,
): Promise<{ message: string; data: Geography }> {
  await requirePermission("geography", "create");
  log.info("createGeography action called");
  const result = await createGeographyCtrl({ payload });
  revalidatePath("/geographies");
  log.info({ id: result.data.id }, "createGeography action completed");
  return { message: result.message, data: result.data.toJSON() };
}

export async function updateGeography(
  id: number,
  payload: UpdateGeographyPayload,
): Promise<{ message: string; data: Geography }> {
  await requirePermission("geography", "update");
  log.info({ id }, "updateGeography action called");
  const result = await updateGeographyCtrl({ id, payload });
  revalidatePath("/geographies");
  return { message: result.message, data: result.data.toJSON() };
}

export async function deleteGeography(
  id: number,
): Promise<{ message: string }> {
  await requirePermission("geography", "delete");
  log.info({ id }, "deleteGeography action called");
  const result = await deleteGeographyCtrl({ id });
  revalidatePath("/geographies");
  log.info({ id }, "deleteGeography action completed");
  return { message: result.message };
}
