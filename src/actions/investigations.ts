"use server";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import type { AdminAction } from "@catalog/collections/reload-job-collection";
import {
  deleteReloadJob as deleteReloadJobCtrl,
  rerunReloadJob as rerunReloadJobCtrl,
  runAdminAction as runAdminActionCtrl,
} from "@catalog/controllers/investigations";

import { createLogger } from "@/core/observability/logger";
import { getCurrentUserId, getCurrentUserRole } from "@/lib/auth/dal";
import { AuthorizationError } from "@/lib/errors";

const log = createLogger("action.investigations");

export async function deleteReloadJob(id: number) {
  const role = await getCurrentUserRole();
  if (!["internal", "admin", "dev"].includes(role))
    throw new AuthorizationError();
  const userId = await getCurrentUserId();
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
  const role = await getCurrentUserRole();
  if (!["internal", "admin", "dev"].includes(role))
    throw new AuthorizationError();
  const userId = await getCurrentUserId();
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

export async function runAdminAction(action: AdminAction) {
  const role = await getCurrentUserRole();
  if (!["internal", "admin", "dev"].includes(role))
    throw new AuthorizationError();
  const userId = await getCurrentUserId();
  log.info({ action, userId }, "runAdminAction called");
  try {
    const result = await runAdminActionCtrl({ action });
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
