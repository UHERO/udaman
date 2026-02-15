export type UserAttrs = {
  id: number;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  universe?: string | null;
  encrypted_password?: string | null;
  password_salt?: string | null;
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
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export default User;
