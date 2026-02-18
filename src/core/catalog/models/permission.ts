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
   *  Wildcards (*) match anything. */
  matches(resource: string, action: string): boolean {
    const resourceMatch = this.resource === "*" || this.resource === resource;
    const actionMatch = this.action === "*" || this.action === action;
    return resourceMatch && actionMatch;
  }

  /** Specificity score: exact resource = +2, exact action = +1. Higher wins. */
  get specificity(): number {
    let score = 0;
    if (this.resource !== "*") score += 2;
    if (this.action !== "*") score += 1;
    return score;
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
