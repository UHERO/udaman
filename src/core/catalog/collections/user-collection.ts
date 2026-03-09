import { compare, hash } from "bcryptjs";

import { mysql } from "@/lib/mysql/db";

import User from "../models/user";
import type { UserAttrs } from "../models/user";

const BCRYPT_ROUNDS = 12;

const VALID_ROLES = ["external", "fsonly", "internal", "admin", "dev"] as const;

class UserCollection {
  /** Fetch all users (excludes password fields), ordered by name */
  static async list(): Promise<User[]> {
    const rows = await mysql<UserAttrs>`
      SELECT id, email, name, role, universe, created_at, updated_at
      FROM users ORDER BY name ASC, email ASC
    `;
    return rows.map((r) => new User(r));
  }

  /** Fetch a user by ID (excludes password fields) */
  static async getById(id: number): Promise<User> {
    const rows = await mysql<UserAttrs>`
      SELECT id, email, name, role, universe, created_at, updated_at
      FROM users WHERE id = ${id}
    `;
    if (!rows.length) throw new Error("User not found");
    return new User(rows[0]);
  }

  /** Update a user's role */
  static async updateRole(id: number, role: string): Promise<void> {
    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      throw new Error(`Invalid role: ${role}`);
    }
    const result = (await mysql`
      UPDATE users SET role = ${role}, updated_at = NOW()
      WHERE id = ${id}
    `) as unknown as { count: number };
    if (result.count === 0) throw new Error("User not found");
  }

  /** Change a user's password after verifying the current one */
  static async changePassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const rows = await mysql<{ encrypted_password: string | null }>`
      SELECT encrypted_password FROM users WHERE id = ${id}
    `;
    if (!rows.length) throw new Error("User not found");

    const stored = rows[0].encrypted_password;
    if (!stored || !stored.startsWith("$2")) {
      throw new Error(
        "Password authentication is not configured for this account",
      );
    }

    const valid = await compare(currentPassword, stored);
    if (!valid) throw new Error("Current password is incorrect");

    const hashed = await hash(newPassword, BCRYPT_ROUNDS);
    await mysql`
      UPDATE users SET encrypted_password = ${hashed}, updated_at = NOW()
      WHERE id = ${id}
    `;
  }
}

export default UserCollection;
