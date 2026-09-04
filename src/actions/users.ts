"use server";

import { revalidatePath } from "next/cache";
import { AppLogCollection } from "@catalog/collections/app-log-collection";
import {
  changePassword as changePasswordCtrl,
  createUser as createUserCtrl,
  getUser as getUserCtrl,
  getUsers as getUsersCtrl,
  updateUser as updateUserCtrl,
  updateUserRole as updateUserRoleCtrl,
} from "@catalog/controllers/users";

import { createLogger } from "@/core/observability/logger";
import { getCurrentUserId, getCurrentUserRole } from "@/lib/auth/dal";
import { hasFullAccess } from "@/lib/auth/roles";
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

  // Last-active comes from page-view logs rather than the sign-in columns:
  // JWT sessions live for weeks, so a sign-in says little about recent use.
  const [result, lastActive] = await Promise.all([
    getUsersCtrl(),
    AppLogCollection.getLastActiveByUser(),
  ]);

  return result.data.map((u) => ({
    ...u.toJSON(),
    lastActiveAt: lastActive.get(u.id)?.toISOString() ?? null,
  }));
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

export async function updateUserAction(
  userId: number,
  payload: {
    email?: string;
    name?: string | null;
    role?: string;
    universe?: string;
    /** Omit to leave the existing password untouched. */
    password?: string;
  },
): Promise<{ success: boolean; message: string }> {
  const currentRole = await getCurrentUserRole();
  if (currentRole !== "dev")
    throw new AuthorizationError("Unauthorized: dev role required");

  const currentUserId = await getCurrentUserId();
  const passwordChanged = payload.password !== undefined;
  log.info(
    { userId, fields: Object.keys(payload), passwordChanged, currentUserId },
    "updateUserAction called",
  );

  try {
    const result = await updateUserCtrl({ id: userId, payload });
    revalidatePath("/admin/users");

    AppLogCollection.log({
      category: "user",
      name: "user.update",
      userId: currentUserId,
      subject: "users",
      subjectId: userId,
      // Field names only — never the values, and never the password.
      metadata: { fields: Object.keys(payload), passwordChanged },
    });

    log.info({ userId, currentUserId }, "updateUserAction completed");
    return { success: true, message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { err: message, userId, currentUserId },
      "updateUserAction failed",
    );
    AppLogCollection.logError(err, {
      userId: currentUserId,
      name: "user.update",
    });
    return { success: false, message };
  }
}

/**
 * Create an account. Admins and devs may do this (it is how anyone gets in,
 * since sign-in never auto-creates). Omit `password` for UH-login-only
 * accounts, which is the normal case.
 */
export async function createUserAction(payload: {
  email: string;
  name?: string | null;
  role: string;
  universe: string;
  password?: string;
}): Promise<{ success: boolean; message: string; id?: number }> {
  const currentRole = await getCurrentUserRole();
  if (!hasFullAccess(currentRole))
    throw new AuthorizationError("Unauthorized: admin role required");
  // Admin and dev accounts are granted by a dev, never handed out on invite.
  if (hasFullAccess(payload.role) && currentRole !== "dev")
    throw new AuthorizationError(
      "Unauthorized: only a dev can create admin or dev accounts",
    );

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
