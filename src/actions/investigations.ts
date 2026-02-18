"use server";

import {
  deleteReloadJob as deleteReloadJobCtrl,
  runAdminAction as runAdminActionCtrl,
} from "@catalog/controllers/investigations";
import type { AdminAction } from "@catalog/collections/reload-job-collection";

import { getCurrentUserRole } from "@/lib/auth/dal";

export async function deleteReloadJob(id: number) {
  const role = await getCurrentUserRole();
  if (role !== "dev") throw new Error("Unauthorized");
  return deleteReloadJobCtrl({ id });
}

export async function runAdminAction(action: AdminAction) {
  const role = await getCurrentUserRole();
  if (role !== "dev") throw new Error("Unauthorized");
  return runAdminActionCtrl({ action });
}
