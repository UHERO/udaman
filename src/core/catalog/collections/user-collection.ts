import { compare, hash } from "bcryptjs";

import { createLogger } from "@/core/observability/logger";
import { DEVISE_PEPPER } from "@/lib/auth/pepper";
import { ALL_ROLES } from "@/lib/auth/roles";
import { insertAndGetId, mysql } from "@/lib/mysql/db";

import User from "../models/user";
import type { UserAttrs } from "../models/user";

const log = createLogger("collection.users");

const BCRYPT_ROUNDS = 12;

const VALID_ROLES = ALL_ROLES;

export interface CreateUserPayload {
  email: string;
  name?: string | null;
  role: string;
  universe: string;
  password: string;
}

/** Fields an admin may change on an existing user. Omitted keys are left as-is;
 *  `password` replaces the stored hash without needing the current password. */
export interface UpdateUserPayload {
  email?: string;
  name?: string | null;
  role?: string;
  universe?: string;
  password?: string;
}

class UserCollection {
  /** Fetch all users (excludes password fields), ordered by name */
  static async list(): Promise<User[]> {
    const rows = await mysql<UserAttrs>`
      SELECT id, email, name, role, universe,
             sign_in_count, current_sign_in_at, current_sign_in_ip,
             last_sign_in_at, last_sign_in_ip, created_at, updated_at
      FROM users ORDER BY name ASC, email ASC
    `;
    return rows.map((r) => new User(r));
  }

  /** Create a new user with a bcrypt-hashed password */
  static async create(payload: CreateUserPayload): Promise<User> {
    const email = payload.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required");

    if (!VALID_ROLES.includes(payload.role as (typeof VALID_ROLES)[number])) {
      throw new Error(`Invalid role: ${payload.role}`);
    }
    if (!payload.password || payload.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const existing = await mysql<{ id: number }>`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;
    if (existing.length) throw new Error(`Email already in use: ${email}`);

    const hashed = await hash(payload.password + DEVISE_PEPPER, BCRYPT_ROUNDS);

    const insertId = await insertAndGetId(
      `INSERT INTO users (
        email, name, role, universe, encrypted_password,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [email, payload.name ?? null, payload.role, payload.universe, hashed],
    );
    return this.getById(insertId);
  }

  /** Fetch a user by ID (excludes password fields) */
  static async getById(id: number): Promise<User> {
    const rows = await mysql<UserAttrs>`
      SELECT id, email, name, role, universe,
             sign_in_count, current_sign_in_at, current_sign_in_ip,
             last_sign_in_at, last_sign_in_ip, created_at, updated_at
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

  /**
   * Update an existing user's profile fields, and optionally their password.
   * Only the keys present in `payload` are written. Returns the fresh record.
   */
  static async update(id: number, payload: UpdateUserPayload): Promise<User> {
    // Confirms the user exists before validating anything else.
    await this.getById(id);

    const updates: Record<string, string | null> = {};

    if (payload.email !== undefined) {
      const email = payload.email.trim().toLowerCase();
      if (!email) throw new Error("Email is required");
      const existing = await mysql<{ id: number }>`
        SELECT id FROM users WHERE email = ${email} AND id != ${id} LIMIT 1
      `;
      if (existing.length) throw new Error(`Email already in use: ${email}`);
      updates.email = email;
    }

    if (payload.name !== undefined) {
      updates.name = payload.name?.trim() || null;
    }

    if (payload.role !== undefined) {
      if (!VALID_ROLES.includes(payload.role as (typeof VALID_ROLES)[number])) {
        throw new Error(`Invalid role: ${payload.role}`);
      }
      updates.role = payload.role;
    }

    if (payload.universe !== undefined) {
      const universe = payload.universe.trim();
      if (!universe) throw new Error("Universe is required");
      updates.universe = universe;
    }

    if (payload.password !== undefined) {
      if (payload.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      updates.encrypted_password = await hash(
        payload.password + DEVISE_PEPPER,
        BCRYPT_ROUNDS,
      );
    }

    const columns = Object.keys(updates);
    if (columns.length === 0) return this.getById(id);

    await mysql`
      UPDATE users SET ${mysql(updates, ...columns)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /**
   * Record a successful sign-in, following Devise's Trackable convention:
   * the outgoing `current_*` values rotate down into `last_*`, `current_*`
   * becomes this sign-in, and the counter increments.
   *
   * The assignment order matters: MySQL evaluates SET clauses left to right
   * and later clauses see values written by earlier ones, so `last_sign_in_*`
   * must be assigned before `current_sign_in_*` is overwritten. On a user's
   * very first sign-in there is nothing to rotate, so both pairs take the
   * current values (matching Devise).
   *
   * Fire-and-forget: never throws, so tracking can't block authentication.
   */
  static async recordSignIn(id: number, ip: string | null): Promise<void> {
    try {
      await mysql`
        UPDATE users SET
          last_sign_in_at    = COALESCE(current_sign_in_at, NOW()),
          last_sign_in_ip    = COALESCE(current_sign_in_ip, ${ip}),
          current_sign_in_at = NOW(),
          current_sign_in_ip = ${ip},
          sign_in_count      = COALESCE(sign_in_count, 0) + 1
        WHERE id = ${id}
      `;
    } catch (e) {
      log.error({ err: e, id }, "Failed to record sign-in");
    }
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

    const valid = await compare(currentPassword + DEVISE_PEPPER, stored);
    if (!valid) throw new Error("Current password is incorrect");

    const hashed = await hash(newPassword + DEVISE_PEPPER, BCRYPT_ROUNDS);
    await mysql`
      UPDATE users SET encrypted_password = ${hashed}, updated_at = NOW()
      WHERE id = ${id}
    `;
  }
}

export default UserCollection;
