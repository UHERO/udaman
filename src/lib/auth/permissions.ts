import "server-only";

import PermissionCollection from "@catalog/collections/permission-collection";

import { enforceAccessPolicy, PermissionDeniedError } from "./authorization";
import { getCurrentUserContext } from "./dal";

// Re-export so existing consumers that import from permissions.ts still work
export { PermissionDeniedError };

export async function requirePermission(
  resource: string,
  action: string,
): Promise<void> {
  const { role, universe } = await getCurrentUserContext();

  // Gate 1 — Coarse role+universe policy (throws on denial)
  enforceAccessPolicy(role, universe, resource, action);

  // Gate 2 — Fine-grained DB permissions with wildcard matching
  const allowed = await PermissionCollection.isAllowed(role, resource, action);
  if (!allowed) {
    throw new PermissionDeniedError(resource, action, role);
  }
}
