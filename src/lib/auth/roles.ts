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

import { isUhEmail } from "./google-login";

export const ALL_ROLES = [
  "external",
  "fsonly",
  "internal",
  "fellow",
  "mcp-only",
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
 * deliberately a limited role: a new account can sign in, see the universe
 * homepage, and file pre-release forms in Comms, but an admin or dev must
 * promote it before any other tool becomes visible or reachable.
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

/**
 * Whether a signed-in user with `inviterRole` may create an account for
 * `email`. Anyone can invite a hawaii.edu address; only an admin or dev can
 * create an account on any other domain. This is the sole gate on who gets
 * into UDAMAN, since sign-in never auto-creates accounts.
 */
export function canInviteEmail(inviterRole: string, email: string): boolean {
  return hasFullAccess(inviterRole) || isUhEmail(email);
}

/** Error shown when `canInviteEmail` is false. */
export const INVITE_EMAIL_DENIED =
  "Only an admin or dev can create an account for a non-hawaii.edu address";

/**
 * Roles allowed to read UHERO's restricted (non-public) dataset through the
 * MCP's `unrestricted: true` option. UHERO staff only; fellows, forecast
 * viewers, and DBEDT upload accounts get the public API alone.
 */
export const RESTRICTED_DATA_ROLES: readonly Role[] = [
  "admin",
  "dev",
  "internal",
];

export function canAccessRestrictedData(role: string): boolean {
  return RESTRICTED_DATA_ROLES.includes(role as Role);
}

/** One-line descriptions shown next to each role in role pickers. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  external: "For DBEDT data upload accounts",
  fsonly: "Accounts for viewing forecast snapshots",
  internal: "Default for new UHERO accounts",
  fellow: "Users needing limited access to comms forms",
  "mcp-only": "Can only use the UHERO Data Claude MCP connector",
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

/**
 * Accounts that exist only to authorize the UHERO Data MCP connector in
 * Claude. They can sign in (that is how the OAuth consent step works) and
 * use the public-data MCP tools, but the site itself shows them nothing
 * except a welcome page with setup instructions. No manifest entry or
 * role_permissions row grants them anything.
 */
export function isMcpOnly(role: string): boolean {
  return role === "mcp-only";
}

/**
 * Canonical form for a universe identifier.
 *
 * Universes are written uppercase by hand ("UHERO") but arrive lowercase from
 * URL segments ("/udaman/uhero/...") and from systems that expect lowercase,
 * so every comparison has to normalize first. Uppercase is the canonical form
 * because that is what `users.universe`, `universes.name`, and the `Universe`
 * type all use.
 */
export function normalizeUniverse(universe: string | null | undefined): string {
  return (universe ?? "").trim().toUpperCase();
}

/** Case-insensitive universe equality. */
export function sameUniverse(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeUniverse(a) === normalizeUniverse(b);
}
