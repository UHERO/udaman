import "server-only";

import { createLogger } from "@/core/observability/logger";

import UserCollection from "../collections/user-collection";

const log = createLogger("catalog.users");

/*************************************************************************
 * USERS Controller
 *************************************************************************/

export async function getUsers() {
  log.info("listing all users");
  const data = await UserCollection.list();
  return { data };
}

export async function getUser({ id }: { id: number }) {
  log.info({ id }, "fetching user");
  const data = await UserCollection.getById(id);
  return { data };
}

export async function updateUserRole({
  id,
  role,
}: {
  id: number;
  role: string;
}) {
  log.info({ id, role }, "updating user role");
  await UserCollection.updateRole(id, role);
  log.info({ id, role }, "user role updated");
  return { message: `Role updated to ${role}` };
}

export async function changePassword({
  id,
  currentPassword,
  newPassword,
}: {
  id: number;
  currentPassword: string;
  newPassword: string;
}) {
  log.info({ id }, "changing password");
  await UserCollection.changePassword(id, currentPassword, newPassword);
  log.info({ id }, "password changed");
  return { message: "Password updated successfully" };
}
