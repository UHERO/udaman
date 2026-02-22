import "server-only";

import PermissionCollection from "@catalog/collections/permission-collection";

import { getCurrentUserRole } from "./dal";

export class PermissionDeniedError extends Error {
  constructor(resource: string, action: string, role: string) {
    super(`Permission denied: role "${role}" cannot ${action} on ${resource}`);
    this.name = "PermissionDeniedError";
  }
}

export async function requirePermission(
  resource: string,
  action: string,
): Promise<void> {
  const role = await getCurrentUserRole();
  const allowed = await PermissionCollection.isAllowed(role, resource, action);
  if (!allowed) {
    throw new PermissionDeniedError(resource, action, role);
  }
}
