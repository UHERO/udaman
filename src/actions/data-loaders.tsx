"use server";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { LoaderActionCollection } from "@catalog/collections/loader-action-collection";
import {
  clearLoaderDataPoints as clearLoaderCtrl,
  createDataLoader as createDataLoaderCtrl,
  deleteDataLoader as deleteLoaderCtrl,
  disableDataLoader as disableLoaderCtrl,
  enableDataLoader as enableLoaderCtrl,
  getDataLoader as getDataLoaderCtrl,
  updateDataLoader as updateDataLoaderCtrl,
} from "@catalog/controllers/data-loaders";
import type { DeleteByMode } from "@catalog/collections/series-collection";
import type { Universe } from "@catalog/types/shared";
import type {
  CreateLoaderFormData,
  UpdateLoaderFormData,
} from "@catalog/types/sources";
import { Queue } from "bullmq";

import { createLogger } from "@/core/observability/logger";
import { enqueueSeriesReload } from "@/core/workers/enqueue";
import { redisConnection } from "@/core/workers/connection";
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
  try {
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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ seriesId, err: message }, "createDataLoader action failed");
    AppLogCollection.log({
      level: "error",
      category: "loader",
      name: "loader.create",
      userId,
      subject: "series",
      subjectId: seriesId,
      metadata: { error: message },
    });
    throw e;
  }
}

export async function reloadLoader(loaderId: number, clearFirst = false) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);

  log.info({ loaderId, clearFirst }, "reloadLoader action called — enqueuing");
  const { data: loader } = await getDataLoaderCtrl({ id: loaderId });
  const job = await enqueueSeriesReload({
    seriesId: loader.seriesId!,
    loaderId,
    clearFirst,
  });
  log.info({ loaderId, jobId: job.id }, "reloadLoader job enqueued");

  AppLogCollection.log({
    category: "loader",
    name: "loader.reload",
    userId,
    subject: "data_sources",
    subjectId: loaderId,
  });

  return {
    message: "Reload queued",
    data: { status: "queued" as const, jobId: job.id! },
  };
}

export async function getLoaderJobStatus(jobId: string): Promise<{
  state: "active" | "waiting" | "completed" | "failed" | "unknown";
  result?: string;
  failedReason?: string;
}> {
  await requireAuth();
  const queue = new Queue("default", {
    connection: redisConnection,
    prefix: "udaman",
  });
  try {
    const job = await queue.getJob(jobId);
    if (!job) return { state: "unknown" };
    const state = await job.getState();
    return {
      state: state as "active" | "waiting" | "completed" | "failed" | "unknown",
      result: job.returnvalue ? String(job.returnvalue) : undefined,
      failedReason: job.failedReason ?? undefined,
    };
  } finally {
    await queue.close();
  }
}

export async function clearLoader(
  loaderId: number,
  opts?: { deleteBy?: DeleteByMode; date?: string },
) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);

  log.info({ loaderId, ...opts }, "clearLoader action called");
  try {
    const result = await clearLoaderCtrl({
      id: loaderId,
      deleteBy: opts?.deleteBy,
      date: opts?.date,
    });
    log.info({ loaderId }, "clearLoader action completed");

    AppLogCollection.log({
      category: "loader",
      name: "loader.clear",
      userId,
      subject: "data_sources",
      subjectId: loaderId,
    });

    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ loaderId, err: message }, "clearLoader action failed");
    AppLogCollection.log({
      level: "error",
      category: "loader",
      name: "loader.clear",
      userId,
      subject: "data_sources",
      subjectId: loaderId,
      metadata: { error: message },
    });
    throw e;
  }
}

export async function deleteLoader(loaderId: number) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);

  log.info({ loaderId }, "deleteLoader action called");
  try {
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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ loaderId, err: message }, "deleteLoader action failed");
    AppLogCollection.log({
      level: "error",
      category: "loader",
      name: "loader.delete",
      userId,
      subject: "data_sources",
      subjectId: loaderId,
      metadata: { error: message },
    });
    throw e;
  }
}

export async function disableLoader(loaderId: number) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);

  log.info({ loaderId }, "disableLoader action called");
  try {
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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ loaderId, err: message }, "disableLoader action failed");
    AppLogCollection.log({
      level: "error",
      category: "loader",
      name: "loader.disable",
      userId,
      subject: "data_sources",
      subjectId: loaderId,
      metadata: { error: message },
    });
    throw e;
  }
}

export async function enableLoader(loaderId: number) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);

  log.info({ loaderId }, "enableLoader action called");
  try {
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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ loaderId, err: message }, "enableLoader action failed");
    AppLogCollection.log({
      level: "error",
      category: "loader",
      name: "loader.enable",
      userId,
      subject: "data_sources",
      subjectId: loaderId,
      metadata: { error: message },
    });
    throw e;
  }
}

export async function updateDataLoader(
  loaderId: number,
  payload: UpdateLoaderFormData,
) {
  const session = await requireAuth();
  const userId = parseInt(session.user!.id!);
  const userEmail = session.user!.email ?? null;

  log.info({ loaderId }, "updateDataLoader action called");
  try {
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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ loaderId, err: message }, "updateDataLoader action failed");
    AppLogCollection.log({
      level: "error",
      category: "loader",
      name: "loader.update",
      userId,
      subject: "data_sources",
      subjectId: loaderId,
      metadata: { error: message },
    });
    throw e;
  }
}
