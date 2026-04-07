import "server-only";

/**
 * Role+universe predicates ported from Rails User model.
 * These match the Rails app's authorization checks exactly.
 */

export class PermissionDeniedError extends Error {
  constructor(resource: string, action: string, role: string) {
    super(`Permission denied: role "${role}" cannot ${action} on ${resource}`);
    this.name = "PermissionDeniedError";
  }
}

/** UHERO internal, admin, or dev */
export function isInternalUser(role: string, universe: string): boolean {
  return (
    universe === "UHERO" &&
    (role === "internal" || role === "admin" || role === "dev")
  );
}

/** UHERO admin or dev */
export function isAdminUser(role: string, universe: string): boolean {
  return universe === "UHERO" && (role === "admin" || role === "dev");
}

/** DBEDT external user */
export function isDbedt(role: string, universe: string): boolean {
  return universe === "DBEDT" && role === "external";
}

/** HHF internal/admin/dev user (Hawaii Housing Factbook universe) */
export function isHhf(role: string, universe: string): boolean {
  return (
    universe === "HHF" &&
    (role === "internal" || role === "admin" || role === "dev")
  );
}

/** Forecast-only user (any universe) */
export function isFsonly(role: string): boolean {
  return role === "fsonly";
}

/**
 * Resolve the landing page path for a given role+universe after login.
 *
 * External users (e.g. DBEDT uploaders) don't have access to /series, so we
 * route them to the universe homepage which renders cards filtered by their
 * role. Internal/admin/dev users land directly on /series as before.
 */
export function getLandingPath(role: string, universe: string): string {
  const u = universe.toLowerCase();
  if (role === "external") return `/udaman/${u}`;
  return `/udaman/${u}/series`;
}

/**
 * Gate 1 — Coarse role+universe policy.
 *
 * Checks hardcoded rules matching the Rails Authorization module.
 * Throws PermissionDeniedError on denial.
 * Returns void (passes) if the role+universe is allowed.
 */
export function enforceAccessPolicy(
  role: string,
  universe: string,
  resource: string,
  action: string,
): void {
  // Upload resources: DBEDT external users allowed for any action
  if (resource === "upload") {
    if (isDbedt(role, universe)) return; // allowed
    // Otherwise fall through to general check
  }

  // HHF internal+ users manage their own universe via the factbook upload
  // pipeline, same as UHERO internal+ users do for UHERO.
  if (isHhf(role, universe)) return;

  // Forecast snapshots: fsonly can read; admin+ can delete
  if (resource === "forecast-snapshot") {
    if (isFsonly(role) && action === "read") return; // allowed
    if (isAdminUser(role, universe)) return; // admin can do anything
    // Otherwise fall through to general check
  }

  // Export CSV: fsonly can download CSVs
  if (resource === "export") {
    if (isFsonly(role) && action === "csv-download") return; // allowed
    // Otherwise fall through to general check
  }

  // General check: reads require internal+, writes require admin+
  const isRead = action === "read" || action === "csv-download";
  if (isRead) {
    if (!isInternalUser(role, universe)) {
      throw new PermissionDeniedError(resource, action, role);
    }
  } else {
    // write / create / update / delete / execute
    if (!isAdminUser(role, universe)) {
      throw new PermissionDeniedError(resource, action, role);
    }
  }
}
