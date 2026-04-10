"use server";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { LoaderActionCollection } from "@catalog/collections/loader-action-collection";
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
import { requireAuth } from "@/lib/auth/dal";

const log = createLogger("action.data-loaders");

export async function createDataLoader(
  params: { seriesId: number; universe: Universe },
  payload: CreateLoaderFormData,
) {
  const { seriesId, universe } = params;
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);
  const userEmail = session.user!.email ?? null;

  log.info({ seriesId, universe }, "createDataLoader action called");
  const result = await createDataLoaderCtrl({ seriesId, universe, payload });
  log.info({ seriesId }, "createDataLoader action completed");

  // Fire-and-forget: record loader action + app log
  LoaderActionCollection.create({
    loaderId: result.data.id,
    seriesId,
    userId,
    userEmail,
    action: "CREATE",
    priority: result.data.priority,
    eval: result.data.eval,
  });
  AppLogCollection.log({
    category: "loader",
    name: "loader.create",
    userId,
    subject: "data_sources",
    subjectId: result.data.id,
  });

  return { message: result.message, data: result.data };
}

export async function reloadLoader(loaderId: number, clearFirst = false) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);

  log.info({ loaderId, clearFirst }, "reloadLoader action called");
  const result = await loadDataPointsCtrl({ id: loaderId, clearFirst });
  log.info({ loaderId }, "reloadLoader action completed");

  AppLogCollection.log({
    category: "loader",
    name: "loader.reload",
    userId,
    subject: "data_sources",
    subjectId: loaderId,
  });

  return result;
}

export async function clearLoader(loaderId: number) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);

  log.info({ loaderId }, "clearLoader action called");
  const result = await clearLoaderCtrl({ id: loaderId });
  log.info({ loaderId }, "clearLoader action completed");

  AppLogCollection.log({
    category: "loader",
    name: "loader.clear",
    userId,
    subject: "data_sources",
    subjectId: loaderId,
  });

  return result;
}

export async function deleteLoader(loaderId: number) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);

  log.info({ loaderId }, "deleteLoader action called");
  const result = await deleteLoaderCtrl({ id: loaderId });
  log.info({ loaderId }, "deleteLoader action completed");

  AppLogCollection.log({
    category: "loader",
    name: "loader.delete",
    userId,
    subject: "data_sources",
    subjectId: loaderId,
  });

  return result;
}

export async function disableLoader(loaderId: number) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);

  log.info({ loaderId }, "disableLoader action called");
  const result = await disableLoaderCtrl({ id: loaderId });
  log.info({ loaderId }, "disableLoader action completed");

  AppLogCollection.log({
    category: "loader",
    name: "loader.disable",
    userId,
    subject: "data_sources",
    subjectId: loaderId,
  });

  return result;
}

export async function enableLoader(loaderId: number) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);

  log.info({ loaderId }, "enableLoader action called");
  const result = await enableLoaderCtrl({ id: loaderId });
  log.info({ loaderId }, "enableLoader action completed");

  AppLogCollection.log({
    category: "loader",
    name: "loader.enable",
    userId,
    subject: "data_sources",
    subjectId: loaderId,
  });

  return result;
}

export async function updateDataLoader(
  loaderId: number,
  payload: UpdateLoaderFormData,
) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);
  const userEmail = session.user!.email ?? null;

  log.info({ loaderId }, "updateDataLoader action called");
  const result = await updateDataLoaderCtrl({ id: loaderId, payload });
  log.info({ loaderId }, "updateDataLoader action completed");

  // Fire-and-forget: record loader action + app log
  LoaderActionCollection.create({
    loaderId,
    seriesId: result.data.seriesId!,
    userId,
    userEmail,
    action: "UPDATE",
    priority: result.data.priority,
    eval: result.data.eval,
  });
  AppLogCollection.log({
    category: "loader",
    name: "loader.update",
    userId,
    subject: "data_sources",
    subjectId: loaderId,
  });

  return result;
}
