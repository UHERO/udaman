"use server";

import PermissionCollection from "@catalog/collections/permission-collection";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requireAuth } from "@/lib/auth/dal";
import { AuthorizationError } from "@/lib/errors";

const log = createLogger("action.permissions");

export async function updatePermissions(payload: {
  updates: { id: number; allowed: boolean }[];
  creates: {
    role: string;
    resource: string;
    action: string;
    allowed: boolean;
  }[];
}): Promise<{ message: string }> {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    throw new AuthorizationError("Unauthorized: dev role required");
  }

  const userId = parseInt(session.user.id!);
  log.info({ userId, updates: payload.updates.length, creates: payload.creates.length }, "updatePermissions action called");

  try {
    if (payload.updates.length > 0) {
      await PermissionCollection.bulkUpdateAllowed(payload.updates);
    }
    if (payload.creates.length > 0) {
      await PermissionCollection.bulkCreate(payload.creates);
    }

    const total = payload.updates.length + payload.creates.length;
    log.info({ userId, total }, "updatePermissions action completed");
    AppLogCollection.log({ category: "permission", name: "permission.update", userId });
    return { message: `Saved ${total} permission(s)` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updatePermissions failed");
    AppLogCollection.logError(err, { userId, name: "permission.update" });
    throw err;
  }
}
