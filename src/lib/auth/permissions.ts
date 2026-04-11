import "server-only";

import PermissionCollection from "@catalog/collections/permission-collection";

import { enforceAccessPolicy, PermissionDeniedError } from "./authorization";
import { getCurrentUserContext } from "./dal";
import { AppLogCollection } from "@/core/catalog/collections/app-log-collection";

// Re-export so existing consumers that import from permissions.ts still work
export { PermissionDeniedError };

export async function requirePermission(
  resource: string,
  action: string,
): Promise<{ userId: number; role: string; universe: string }> {
  const { role, universe, userId } = await getCurrentUserContext();
  // Gate 1 — Coarse role+universe policy (throws on denial)
  enforceAccessPolicy(role, universe, resource, action);

  // Gate 2 — Fine-grained DB permissions with wildcard matching
  const allowed = await PermissionCollection.isAllowed(role, resource, action);
  if (!allowed) {
    throw new PermissionDeniedError(resource, action, role);
  }

  const numericUserId = userId ? parseInt(userId) : 0;

  // Log non-read actions to app_logs (fire-and-forget)
  if (action !== "read") {
    AppLogCollection.log({
      category: resource,
      name: `${resource}.${action}`,
      userId: numericUserId || undefined,
    });
  }

  return { userId: numericUserId, role, universe };
}
