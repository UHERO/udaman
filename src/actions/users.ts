"use server";

import {
  changePassword as changePasswordCtrl,
  getUser as getUserCtrl,
  getUsers as getUsersCtrl,
  updateUserRole as updateUserRoleCtrl,
} from "@catalog/controllers/users";

import { createLogger } from "@/core/observability/logger";
import { getCurrentUserId, getCurrentUserRole } from "@/lib/auth/dal";

const log = createLogger("action.users");

export async function getUser() {
  const userId = await getCurrentUserId();
  log.info({ userId }, "getUser action called");
  const result = await getUserCtrl({ id: userId });
  return result.data.toJSON();
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  const userId = await getCurrentUserId();
  log.info({ userId }, "changePassword action called");
  const result = await changePasswordCtrl({
    id: userId,
    currentPassword,
    newPassword,
  });
  log.info({ userId }, "changePassword action completed");
  return { message: result.message };
}

export async function listUsers() {
  const role = await getCurrentUserRole();
  if (role !== "dev") throw new Error("Unauthorized");
  const result = await getUsersCtrl();
  return result.data.map((u) => u.toJSON());
}

export async function updateUserRole(userId: number, role: string) {
  const currentRole = await getCurrentUserRole();
  if (currentRole !== "dev") throw new Error("Unauthorized");
  const result = await updateUserRoleCtrl({ id: userId, role });
  return { message: result.message };
}
