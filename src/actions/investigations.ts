"use server";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import type {
  AdminAction,
  AdminActionOptions,
} from "@catalog/collections/reload-job-collection";
import {
  deleteReloadJob as deleteReloadJobCtrl,
  rerunReloadJob as rerunReloadJobCtrl,
  runAdminAction as runAdminActionCtrl,
} from "@catalog/controllers/investigations";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.investigations");

export async function deleteReloadJob(id: number) {
  const { userId } = await requirePermission("investigation", "delete");
  log.info({ id, userId }, "deleteReloadJob action called");
  try {
    const result = await deleteReloadJobCtrl({ id });
    AppLogCollection.log({
      category: "investigation",
      name: "investigation.delete_job",
      userId,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteReloadJob failed");
    AppLogCollection.logError(err, {
      userId,
      name: "investigation.delete_job",
    });
    throw err;
  }
}

export async function rerunReloadJob(id: number) {
  const { userId } = await requirePermission("investigation", "update");
  log.info({ id, userId }, "rerunReloadJob action called");
  try {
    const result = await rerunReloadJobCtrl({ id });
    AppLogCollection.log({
      category: "investigation",
      name: "investigation.rerun_job",
      userId,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "rerunReloadJob failed");
    AppLogCollection.logError(err, { userId, name: "investigation.rerun_job" });
    throw err;
  }
}

export async function runAdminAction(
  action: AdminAction,
  options: AdminActionOptions = {},
) {
  const { userId } = await requirePermission("investigation", "execute");
  log.info({ action, userId, ...options }, "runAdminAction called");
  try {
    const result = await runAdminActionCtrl({ action, options });
    AppLogCollection.log({
      category: "investigation",
      name: `investigation.${action}`,
      userId,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "runAdminAction failed");
    AppLogCollection.logError(err, { userId, name: `investigation.${action}` });
    throw err;
  }
}
