import { parentResource } from "@/lib/auth/resources";

export type PermissionAttrs = {
  id: number;
  role: string;
  resource?: string;
  action?: string;
  allowed?: number | boolean;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

class Permission {
  readonly id: number;
  readonly role: string;
  readonly resource: string;
  readonly action: string;
  readonly allowed: boolean;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;

  constructor(attrs: PermissionAttrs) {
    this.id = attrs.id;
    this.role = attrs.role;
    this.resource = attrs.resource ?? "*";
    this.action = attrs.action ?? "*";
    this.allowed = Boolean(attrs.allowed);
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  /** Check if this permission rule matches a given resource and action.
   *  Wildcards (*) match anything. A rule on a sidebar-level resource also
   *  matches the finer-grained resources that roll up to it (see
   *  RESOURCE_PARENTS), e.g. a "catalog" rule covers "measurement". */
  matches(resource: string, action: string): boolean {
    const resourceMatch =
      this.resource === "*" ||
      this.resource === resource ||
      this.resource === parentResource(resource);
    const actionMatch = this.action === "*" || this.action === action;
    return resourceMatch && actionMatch;
  }

  /**
   * Specificity for a given lookup — higher wins:
   *   exact resource = +4, parent resource = +2, exact action = +1.
   * So an exact child rule beats its parent, and either beats a wildcard,
   * regardless of whether the action is exact.
   */
  specificityFor(resource: string): number {
    let score = 0;
    if (this.resource === resource) score += 4;
    else if (
      this.resource !== "*" &&
      this.resource === parentResource(resource)
    )
      score += 2;
    if (this.action !== "*") score += 1;
    return score;
  }

  /** Resolve a resource/action against a rule set. No match = denied. */
  static resolve(
    permissions: readonly Permission[],
    resource: string,
    action: string,
  ): boolean {
    let bestMatch: Permission | null = null;
    let bestSpecificity = -1;
    for (const perm of permissions) {
      if (!perm.matches(resource, action)) continue;
      const specificity = perm.specificityFor(resource);
      if (specificity > bestSpecificity) {
        bestMatch = perm;
        bestSpecificity = specificity;
      }
    }
    return bestMatch?.allowed ?? false;
  }

  toString(): string {
    return `${this.role}: ${this.resource}.${this.action} = ${this.allowed ? "allow" : "deny"}`;
  }

  toJSON() {
    return {
      id: this.id,
      role: this.role,
      resource: this.resource,
      action: this.action,
      allowed: this.allowed,
    };
  }
}

export default Permission;
