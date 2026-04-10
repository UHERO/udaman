"use server";

import type { AdminAction } from "@catalog/collections/reload-job-collection";
import {
  deleteReloadJob as deleteReloadJobCtrl,
  rerunReloadJob as rerunReloadJobCtrl,
  runAdminAction as runAdminActionCtrl,
} from "@catalog/controllers/investigations";

import { getCurrentUserRole } from "@/lib/auth/dal";

export async function deleteReloadJob(id: number) {
  const role = await getCurrentUserRole();
  if (!["internal", "admin", "dev"].includes(role))
    throw new Error("Unauthorized");
  return deleteReloadJobCtrl({ id });
}

export async function rerunReloadJob(id: number) {
  const role = await getCurrentUserRole();
  if (!["internal", "admin", "dev"].includes(role))
    throw new Error("Unauthorized");
  return rerunReloadJobCtrl({ id });
}

export async function runAdminAction(action: AdminAction) {
  const role = await getCurrentUserRole();
  if (!["internal", "admin", "dev"].includes(role))
    throw new Error("Unauthorized");
  return runAdminActionCtrl({ action });
}
