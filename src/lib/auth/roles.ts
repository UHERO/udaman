/**
 * Role constants shared by the route manifest, the auth adapter, the admin
 * user form, and server-action guards. Pure data — safe to import from
 * client components, edge middleware, and bun tests.
 *
 * Adding a role: extend ALL_ROLES here, add it to the `users_role` enum in
 * src/lib/prisma/schema.prisma plus a migration that ALTERs `users.role` and
 * `role_permissions.role`, seed its rows in role_permissions, and give it a
 * description in the admin permissions panel.
 */

export const ALL_ROLES = [
  "external",
  "fsonly",
  "internal",
  "fellow",
  "admin",
  "dev",
] as const;

export type Role = (typeof ALL_ROLES)[number];

export function isRole(value: string): value is Role {
  return (ALL_ROLES as readonly string[]).includes(value);
}

/**
 * Roles with full access to every UDAMAN tool. Every other role is limited
 * to the universe homepage plus whatever the route manifest explicitly
 * whitelists for it (DBEDT external uploads; the fellow apps).
 */
export const FULL_ACCESS_ROLES: readonly Role[] = ["admin", "dev"];

/**
 * Role and universe assigned to accounts auto-created on first Google
 * sign-in, and the defaults in the admin "new user" form. `internal` is
 * deliberately a limited role: a new account can sign in and see the
 * universe homepage, but an admin or dev must promote it before any tool
 * becomes visible or reachable.
 */
export const NEW_USER_ROLE: Role = "internal";
export const NEW_USER_UNIVERSE = "UHERO";

export function hasFullAccess(role: string): boolean {
  return FULL_ACCESS_ROLES.includes(role as Role);
}

/**
 * Roles an admin may hand out when inviting someone. admin and dev are
 * deliberately absent: those are granted by a dev on the admin Users page.
 */
export const INVITE_ROLES: readonly Role[] = ALL_ROLES.filter(
  (r) => !hasFullAccess(r),
);

/** One-line descriptions shown next to each role in role pickers. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  external: "For DBEDT data upload accounts",
  fsonly: "Accounts for viewing forecast snapshots",
  internal: "Default for new UHERO accounts",
  fellow: "Users needing limited access to comms forms",
  admin: "Full access to every tool",
  dev: "Full access plus developer tools and permissions",
};

/**
 * Research fellows. By default they get the Housing Database, Comms, and
 * Registry apps and nothing else. Their server-side access is governed
 * entirely by the role_permissions table (see enforceAccessPolicy), so a
 * dev can widen or narrow it from the admin Permissions page.
 */
export function isFellow(role: string): boolean {
  return role === "fellow";
}
