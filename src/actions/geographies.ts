"use server";

import { revalidatePath } from "next/cache";
import { createLogger } from "@/core/observability/logger";
import {
  getGeographies as fetchGeographies,
  createGeography as createGeographyCtrl,
  updateGeography as updateGeographyCtrl,
  deleteGeography as deleteGeographyCtrl,
} from "@catalog/controllers/geographies";
import type { CreateGeographyPayload, UpdateGeographyPayload } from "@catalog/collections/geography-collection";
import type { Geography, Universe } from "@catalog/types/shared";

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
  payload: CreateGeographyPayload
): Promise<Geography> {
  log.info("createGeography action called");
  const result = await createGeographyCtrl({ payload });
  revalidatePath("/geographies");
  log.info({ id: result.data.id }, "createGeography action completed");
  return result.data.toJSON();
}

export async function updateGeography(
  id: number,
  payload: UpdateGeographyPayload
): Promise<Geography> {
  log.info({ id }, "updateGeography action called");
  const result = await updateGeographyCtrl({ id, payload });
  revalidatePath("/geographies");
  return result.data.toJSON();
}

export async function deleteGeography(id: number): Promise<void> {
  log.info({ id }, "deleteGeography action called");
  await deleteGeographyCtrl({ id });
  revalidatePath("/geographies");
  log.info({ id }, "deleteGeography action completed");
}
