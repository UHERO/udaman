"use server";

import {
  clearLoaderDataPoints as clearLoaderCtrl,
  createDataLoader as createDataLoaderCtrl,
  deleteDataLoader as deleteLoaderCtrl,
  disableDataLoader as disableLoaderCtrl,
  enableDataLoader as enableLoaderCtrl,
  loadDataPoints as loadDataPointsCtrl,
  updateDataLoader as updateDataLoaderCtrl,
} from "@catalog/controllers/data-loaders";
import type { Universe } from "@catalog/types/shared";
import type {
  CreateLoaderFormData,
  UpdateLoaderFormData,
} from "@catalog/types/sources";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("action.data-loaders");

export async function createDataLoader(
  params: { seriesId: number; universe: Universe },
  payload: CreateLoaderFormData,
) {
  const { seriesId, universe } = params;
  log.info({ seriesId, universe }, "createDataLoader action called");
  const result = await createDataLoaderCtrl({ seriesId, universe, payload });
  log.info({ seriesId }, "createDataLoader action completed");
  return { message: result.message, data: result.data };
}

export async function reloadLoader(loaderId: number, clearFirst = false) {
  log.info({ loaderId, clearFirst }, "reloadLoader action called");
  const result = await loadDataPointsCtrl({ id: loaderId, clearFirst });
  log.info({ loaderId }, "reloadLoader action completed");
  return result;
}

export async function clearLoader(loaderId: number) {
  log.info({ loaderId }, "clearLoader action called");
  const result = await clearLoaderCtrl({ id: loaderId });
  log.info({ loaderId }, "clearLoader action completed");
  return result;
}

export async function deleteLoader(loaderId: number) {
  log.info({ loaderId }, "deleteLoader action called");
  const result = await deleteLoaderCtrl({ id: loaderId });
  log.info({ loaderId }, "deleteLoader action completed");
  return result;
}

export async function disableLoader(loaderId: number) {
  log.info({ loaderId }, "disableLoader action called");
  const result = await disableLoaderCtrl({ id: loaderId });
  log.info({ loaderId }, "disableLoader action completed");
  return result;
}

export async function enableLoader(loaderId: number) {
  log.info({ loaderId }, "enableLoader action called");
  const result = await enableLoaderCtrl({ id: loaderId });
  log.info({ loaderId }, "enableLoader action completed");
  return result;
}

export async function updateDataLoader(
  loaderId: number,
  payload: UpdateLoaderFormData,
) {
  log.info({ loaderId }, "updateDataLoader action called");
  const result = await updateDataLoaderCtrl({ id: loaderId, payload });
  log.info({ loaderId }, "updateDataLoader action completed");
  return result;
}
