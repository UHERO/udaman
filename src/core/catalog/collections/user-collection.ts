import { compare, hash } from "bcryptjs";

import { createLogger } from "@/core/observability/logger";
import { canUseGoogleLogin } from "@/lib/auth/google-login";
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
  /** May be omitted only for addresses that can use UH Google login
   *  (see canUseGoogleLogin); everyone else needs one to sign in at all. */
  password?: string;
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

  /**
   * Create a new user. With a password it is bcrypt-hashed (Devise-compatible);
   * without one the account can only sign in through UH Google login, since
   * the credentials provider rejects an empty hash.
   */
  static async create(payload: CreateUserPayload): Promise<User> {
    const email = payload.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new Error("A valid email is required");
    }

    if (!VALID_ROLES.includes(payload.role as (typeof VALID_ROLES)[number])) {
      throw new Error(`Invalid role: ${payload.role}`);
    }
    if (payload.password !== undefined && payload.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    if (!payload.password && !canUseGoogleLogin(email)) {
      throw new Error(`${email} can't use UH Login, so a password is required`);
    }

    const existing = await mysql<{ id: number }>`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;
    if (existing.length) throw new Error(`Email already in use: ${email}`);

    const hashed = payload.password
      ? await hash(payload.password + DEVISE_PEPPER, BCRYPT_ROUNDS)
      : "";

    const insertId = await insertAndGetId(
      `INSERT INTO users (
        email, name, role, universe, encrypted_password,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        email,
        payload.name?.trim() || null,
        payload.role,
        payload.universe,
        hashed,
      ],
    );
    return this.getById(insertId);
  }

  /** Fetch a user by email (case-insensitive), or null if none exists. */
  static async getByEmail(email: string): Promise<User | null> {
    const rows = await mysql<UserAttrs>`
      SELECT id, email, name, role, universe,
             sign_in_count, current_sign_in_at, current_sign_in_ip,
             last_sign_in_at, last_sign_in_ip, created_at, updated_at
      FROM users WHERE email = ${email.trim().toLowerCase()} LIMIT 1
    `;
    return rows.length ? new User(rows[0]) : null;
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

  /**
   * Update a user's role. Existence is checked with a SELECT first rather
   * than by inspecting the UPDATE result: MySQL reports 0 affected rows when
   * the row matched but nothing changed, which used to surface as a bogus
   * "User not found".
   */
  static async updateRole(id: number, role: string): Promise<void> {
    await this.update(id, { role });
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
