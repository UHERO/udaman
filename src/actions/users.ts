"use server";

import {
  changePassword as changePasswordCtrl,
  getUser as getUserCtrl,
} from "@catalog/controllers/users";

import { createLogger } from "@/core/observability/logger";
import { getCurrentUserId } from "@/lib/auth/dal";

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
