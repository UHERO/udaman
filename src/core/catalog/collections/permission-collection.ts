import { mysql } from "@/lib/mysql/db";

import Permission from "../models/permission";
import type { PermissionAttrs } from "../models/permission";

type CacheEntry = {
  permissions: Permission[];
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000; // 60 seconds
const cache = new Map<string, CacheEntry>();

class PermissionCollection {
  /** Fetch all permission rows for a role, with 60s in-memory cache. */
  static async getByRole(role: string): Promise<Permission[]> {
    const entry = cache.get(role);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.permissions;
    }

    const rows = await mysql<PermissionAttrs>`
      SELECT * FROM role_permissions WHERE role = ${role}
    `;
    const permissions = rows.map((row) => new Permission(row));

    cache.set(role, {
      permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return permissions;
  }

  /** Check if a role is allowed to perform an action on a resource.
   *  Finds the best match by specificity. No match = denied. */
  static async isAllowed(
    role: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const permissions = await this.getByRole(role);

    let bestMatch: Permission | null = null;
    let bestSpecificity = -1;

    for (const perm of permissions) {
      if (perm.matches(resource, action) && perm.specificity > bestSpecificity) {
        bestMatch = perm;
        bestSpecificity = perm.specificity;
      }
    }

    return bestMatch?.allowed ?? false;
  }

  /** Fetch all permission rows, ordered by role/resource/action. */
  static async list(): Promise<Permission[]> {
    const rows = await mysql<PermissionAttrs>`
      SELECT * FROM role_permissions ORDER BY role, resource, action
    `;
    return rows.map((row) => new Permission(row));
  }

  /** Bulk update the `allowed` flag on multiple permission rows. */
  static async bulkUpdateAllowed(
    updates: { id: number; allowed: boolean }[],
  ): Promise<void> {
    for (const { id, allowed } of updates) {
      await mysql`
        UPDATE role_permissions
        SET allowed = ${allowed ? 1 : 0}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }
    this.invalidateCache();
  }

  /** Create new permission rows. */
  static async bulkCreate(
    rows: { role: string; resource: string; action: string; allowed: boolean }[],
  ): Promise<void> {
    for (const { role, resource, action, allowed } of rows) {
      await mysql`
        INSERT INTO role_permissions (role, resource, action, allowed, created_at, updated_at)
        VALUES (${role}, ${resource}, ${action}, ${allowed ? 1 : 0}, NOW(), NOW())
      `;
    }
    this.invalidateCache();
  }

  /** Clear the cache for a specific role, or all roles if none specified. */
  static invalidateCache(role?: string): void {
    if (role) {
      cache.delete(role);
    } else {
      cache.clear();
    }
  }
}

export default PermissionCollection;
