"use server";

import { createLogger } from "@/core/observability/logger";
import { createDataLoader as createDataLoaderCtrl } from "@catalog/controllers/data-loaders";
import type { Universe } from "@catalog/types/shared";
import type { CreateLoaderFormData } from "@catalog/types/sources";

const log = createLogger("action.data-loaders");

export async function createDataLoader(
  params: { seriesId: number; universe: Universe },
  payload: CreateLoaderFormData
) {
  const { seriesId, universe } = params;
  log.info({ seriesId, universe }, "createDataLoader action called");
  const result = await createDataLoaderCtrl({ seriesId, universe, payload });
  log.info({ seriesId }, "createDataLoader action completed");
  return result.data;
}
