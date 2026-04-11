"use server";

import type { AdminAction } from "@catalog/collections/reload-job-collection";
import {
  deleteReloadJob as deleteReloadJobCtrl,
  rerunReloadJob as rerunReloadJobCtrl,
  runAdminAction as runAdminActionCtrl,
} from "@catalog/controllers/investigations";

import { getCurrentUserRole } from "@/lib/auth/dal";
import { AuthorizationError } from "@/lib/errors";

export async function deleteReloadJob(id: number) {
  const role = await getCurrentUserRole();
  if (!["internal", "admin", "dev"].includes(role))
    throw new AuthorizationError();
  return deleteReloadJobCtrl({ id });
}

export async function rerunReloadJob(id: number) {
  const role = await getCurrentUserRole();
  if (!["internal", "admin", "dev"].includes(role))
    throw new AuthorizationError();
  return rerunReloadJobCtrl({ id });
}

export async function runAdminAction(action: AdminAction) {
  const role = await getCurrentUserRole();
  if (!["internal", "admin", "dev"].includes(role))
    throw new AuthorizationError();
  return runAdminActionCtrl({ action });
}
