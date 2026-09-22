export type UserAttrs = {
  id: number;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  universe?: string | null;
  encrypted_password?: string | null;
  password_salt?: string | null;
  sign_in_count?: number | null;
  current_sign_in_at?: Date | string | null;
  current_sign_in_ip?: string | null;
  last_sign_in_at?: Date | string | null;
  last_sign_in_ip?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

class User {
  readonly id: number;
  email: string;
  name: string | null;
  role: string | null;
  universe: string | null;
  encryptedPassword: string | null;
  passwordSalt: string | null;
  /**
   * Devise Trackable columns. `current*` describes the most recent sign-in;
   * `last*` holds the one before it (rotated down on each new sign-in).
   * The DATETIMEs hold HST wall-clock — display via formatHst.
   */
  signInCount: number;
  currentSignInAt: Date | null;
  currentSignInIp: string | null;
  lastSignInAt: Date | null;
  lastSignInIp: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: UserAttrs) {
    this.id = attrs.id;
    this.email = attrs.email ?? "";
    this.name = attrs.name ?? null;
    this.role = attrs.role ?? null;
    this.universe = attrs.universe ?? null;
    this.encryptedPassword = attrs.encrypted_password ?? null;
    this.passwordSalt = attrs.password_salt ?? null;
    this.signInCount = attrs.sign_in_count ?? 0;
    this.currentSignInAt = attrs.current_sign_in_at
      ? new Date(attrs.current_sign_in_at as string | Date)
      : null;
    this.currentSignInIp = attrs.current_sign_in_ip ?? null;
    this.lastSignInAt = attrs.last_sign_in_at
      ? new Date(attrs.last_sign_in_at as string | Date)
      : null;
    this.lastSignInIp = attrs.last_sign_in_ip ?? null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  toString(): string {
    return `User(${this.id}, ${this.email})`;
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      universe: this.universe,
      signInCount: this.signInCount,
      currentSignInAt: this.currentSignInAt?.toISOString() ?? null,
      currentSignInIp: this.currentSignInIp,
      lastSignInAt: this.lastSignInAt?.toISOString() ?? null,
      lastSignInIp: this.lastSignInIp,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export default User;
