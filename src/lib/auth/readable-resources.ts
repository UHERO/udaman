import "server-only";

import PermissionCollection from "@catalog/collections/permission-collection";
import Permission from "@catalog/models/permission";

import { ROUTES } from "./route-access";

/**
 * The permission resources that gate a top-level route. One per manifest
 * entry, deduped — children inherit their parent's resource.
 */
const ROUTE_RESOURCES: readonly string[] = Array.from(
  new Set(ROUTES.map((entry) => entry.resource)),
);

/**
 * Resources this role may `read`, resolved against `role_permissions`.
 *
 * Feeds the sidebar (as a layout prop) and the proxy (as a JWT claim) so both
 * can decide route visibility from the permissions table instead of the
 * hardcoded `roles` arrays in the manifest.
 *
 * Reads go through PermissionCollection, which caches per role for 60s and is
 * invalidated whenever the admin Permissions page saves, so calling this in
 * every layout render costs one query per role per minute.
 */
export async function getReadableResources(role: string): Promise<string[]> {
  const permissions = await PermissionCollection.getByRole(role);
  return ROUTE_RESOURCES.filter((resource) =>
    Permission.resolve(permissions, resource, "read"),
  );
}
