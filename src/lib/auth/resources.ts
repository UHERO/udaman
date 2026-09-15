/**
 * Permission resource hierarchy. Pure data — safe for client components.
 *
 * Every top-level sidebar/rail item owns one permission resource (declared
 * on its ROUTES entry in route-access.ts) and the admin Permissions page
 * shows a create/read/update/delete switch for each. Server actions mostly
 * check finer-grained resources ("category", "worker", ...). Rather than
 * rewrite every call site, the resolver in the Permission model treats a
 * rule on the parent (sidebar-level) resource as applying to its children,
 * with an exact child rule still winning when one exists.
 */

export const CRUD_ACTIONS = ["create", "read", "update", "delete"] as const;
export type CrudAction = (typeof CRUD_ACTIONS)[number];

/** Fine-grained resource → the sidebar-level resource that contains it. */
export const RESOURCE_PARENTS: Record<string, string> = {
  // Data Portal Catalog
  category: "catalog",
  "data-list": "catalog",
  measurement: "catalog",
  geography: "catalog",
  unit: "catalog",
  source: "catalog",
  "source-detail": "catalog",
  universe: "catalog",
  // Data Tools
  timeline_event: "data-tools",
  // Admin
  worker: "admin",
  "feature-toggle": "admin",
};

export function parentResource(resource: string): string | null {
  return RESOURCE_PARENTS[resource] ?? null;
}
