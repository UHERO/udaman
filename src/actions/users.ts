"use server";

import { revalidatePath } from "next/cache";
import { AppLogCollection } from "@catalog/collections/app-log-collection";
import {
  changePassword as changePasswordCtrl,
  createUser as createUserCtrl,
  getUser as getUserCtrl,
  getUsers as getUsersCtrl,
  updateUserRole as updateUserRoleCtrl,
} from "@catalog/controllers/users";

import { createLogger } from "@/core/observability/logger";
import { getCurrentUserId, getCurrentUserRole } from "@/lib/auth/dal";
import { AuthorizationError } from "@/lib/errors";

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
  try {
    const result = await changePasswordCtrl({
      id: userId,
      currentPassword,
      newPassword,
    });
    log.info({ userId }, "changePassword action completed");
    AppLogCollection.log({
      category: "user",
      name: "user.change_password",
      userId,
    });
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "changePassword failed");
    AppLogCollection.logError(err, { userId, name: "user.change_password" });
    throw err;
  }
}

export async function listUsers() {
  const role = await getCurrentUserRole();
  if (role !== "dev")
    throw new AuthorizationError("Unauthorized: dev role required");
  const result = await getUsersCtrl();
  return result.data.map((u) => u.toJSON());
}

export async function updateUserRole(userId: number, role: string) {
  const currentUserId = await getCurrentUserId();
  const currentRole = await getCurrentUserRole();
  if (currentRole !== "dev")
    throw new AuthorizationError("Unauthorized: dev role required");
  log.info({ userId, role, currentUserId }, "updateUserRole action called");
  try {
    const result = await updateUserRoleCtrl({ id: userId, role });

    AppLogCollection.log({
      category: "user",
      name: "user.role_change",
      userId: currentUserId,
      subject: "users",
      subjectId: userId,
      metadata: { newRole: role },
    });

    log.info(
      { userId, role, currentUserId },
      "updateUserRole action completed",
    );
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId: currentUserId }, "updateUserRole failed");
    AppLogCollection.logError(err, {
      userId: currentUserId,
      name: "user.role_change",
    });
    throw err;
  }
}

export async function createUserAction(payload: {
  email: string;
  name?: string | null;
  role: string;
  universe: string;
  password: string;
}): Promise<{ success: boolean; message: string; id?: number }> {
  const currentRole = await getCurrentUserRole();
  if (currentRole !== "dev")
    throw new AuthorizationError("Unauthorized: dev role required");

  try {
    const currentUserId = await getCurrentUserId();
    const result = await createUserCtrl(payload);
    revalidatePath("/admin/users");
    log.info({ id: result.data.id }, "createUserAction completed");

    AppLogCollection.log({
      category: "user",
      name: "user.create",
      userId: currentUserId,
      subject: "users",
      subjectId: result.data.id,
    });

    return { success: true, message: result.message, id: result.data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "createUserAction failed");
    AppLogCollection.logError(err, { name: "user.create" });
    return { success: false, message: `Failed to create user: ${message}` };
  }
}
