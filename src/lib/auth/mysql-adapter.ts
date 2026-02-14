import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "@auth/core/adapters";
import { mysql, rawQuery } from "@database/mysql";

// ─── Row → Auth.js object mappers ────────────────────────────────────

function toAdapterUser(row: Record<string, unknown>): AdapterUser {
  return {
    id: String(row.id),
    email: row.email as string,
    name: (row.name as string) ?? null,
    image: (row.image as string) ?? null,
    emailVerified: row.email_verified
      ? new Date(row.email_verified as string | number | Date)
      : null,
  };
}

function toAdapterSession(
  row: Record<string, unknown>,
): AdapterSession & { id: string } {
  return {
    id: String(row.id),
    sessionToken: row.session_token as string,
    userId: String(row.user_id),
    expires: new Date(row.expires as string | number | Date),
  };
}

function toAdapterAccount(
  row: Record<string, unknown>,
): AdapterAccount & { id: string } {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: row.type as AdapterAccount["type"],
    provider: row.provider as string,
    providerAccountId: row.provider_account_id as string,
    refresh_token: (row.refresh_token as string) ?? null,
    access_token: (row.access_token as string) ?? null,
    expires_at: (row.expires_at as number) ?? null,
    id_token: (row.id_token as string) ?? null,
    token_type: (row.token_type as Lowercase<string>) ?? null,
    scope: (row.scope as string) ?? null,
    session_state: (row.session_state as string) ?? null,
  };
}

// ─── Adapter ─────────────────────────────────────────────────────────

export function MySqlAdapter(): Adapter {
  return {
    // ── User methods ───────────────────────────────────────────────

    async createUser(user) {
      const { email, name, image, emailVerified } = user;
      await mysql`
        INSERT INTO users (email, name, image, email_verified, created_at, updated_at)
        VALUES (${email}, ${name ?? null}, ${image ?? null}, ${emailVerified}, NOW(), NOW())
      `;
      const rows = await mysql`
        SELECT id, email, name, image, email_verified
        FROM users WHERE email = ${email}
      `;
      return toAdapterUser(rows[0]);
    },

    async getUser(id) {
      const rows = await mysql`
        SELECT id, email, name, image, email_verified
        FROM users WHERE id = ${parseInt(id)}
      `;
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async getUserByEmail(email) {
      const rows = await mysql`
        SELECT id, email, name, image, email_verified
        FROM users WHERE email = ${email}
      `;
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const rows = await mysql`
        SELECT u.id, u.email, u.name, u.image, u.email_verified
        FROM users u
        JOIN accounts a ON a.user_id = u.id
        WHERE a.provider = ${provider}
          AND a.provider_account_id = ${providerAccountId}
      `;
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async updateUser(user) {
      const { id, ...data } = user;
      const numericId = parseInt(id);

      // Read current user, merge changes, write back
      const current = (
        await mysql`
          SELECT id, email, name, image, email_verified
          FROM users WHERE id = ${numericId}
        `
      )[0];
      if (!current) throw new Error(`User not found: ${id}`);

      const merged = {
        email: data.email ?? (current.email as string),
        name: data.name !== undefined ? data.name : current.name,
        image: data.image !== undefined ? data.image : current.image,
        emailVerified:
          data.emailVerified !== undefined
            ? data.emailVerified
            : current.email_verified,
      };

      await mysql`
        UPDATE users SET
          email = ${merged.email},
          name = ${merged.name ?? null},
          image = ${merged.image ?? null},
          email_verified = ${merged.emailVerified ?? null},
          updated_at = NOW()
        WHERE id = ${numericId}
      `;

      return toAdapterUser({
        id: numericId,
        email: merged.email,
        name: merged.name,
        image: merged.image,
        email_verified: merged.emailVerified,
      });
    },

    async deleteUser(userId) {
      // ON DELETE CASCADE handles accounts and sessions
      await mysql`DELETE FROM users WHERE id = ${parseInt(userId)}`;
    },

    // ── Account methods ────────────────────────────────────────────

    async linkAccount(account) {
      await mysql`
        INSERT INTO accounts (
          user_id, type, provider, provider_account_id,
          refresh_token, access_token, expires_at,
          token_type, scope, id_token, session_state
        ) VALUES (
          ${parseInt(account.userId)},
          ${account.type},
          ${account.provider},
          ${account.providerAccountId},
          ${account.refresh_token ?? null},
          ${account.access_token ?? null},
          ${account.expires_at ?? null},
          ${account.token_type ?? null},
          ${account.scope ?? null},
          ${account.id_token ?? null},
          ${account.session_state ?? null}
        )
      `;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await mysql`
        DELETE FROM accounts
        WHERE provider = ${provider}
          AND provider_account_id = ${providerAccountId}
      `;
    },

    async getAccount(providerAccountId, provider) {
      const rows = await mysql`
        SELECT * FROM accounts
        WHERE provider = ${provider}
          AND provider_account_id = ${providerAccountId}
      `;
      return rows[0] ? toAdapterAccount(rows[0]) : null;
    },

    // ── Session methods ────────────────────────────────────────────

    async createSession({ sessionToken, userId, expires }) {
      await mysql`
        INSERT INTO sessions (session_token, user_id, expires)
        VALUES (${sessionToken}, ${parseInt(userId)}, ${expires})
      `;
      const rows = await mysql`
        SELECT id, session_token, user_id, expires
        FROM sessions WHERE session_token = ${sessionToken}
      `;
      return toAdapterSession(rows[0]);
    },

    async getSessionAndUser(sessionToken) {
      const rows = await mysql`
        SELECT
          s.id as s_id, s.session_token, s.user_id, s.expires,
          u.id as u_id, u.email, u.name, u.image, u.email_verified
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.session_token = ${sessionToken}
      `;
      if (!rows[0]) return null;
      const row = rows[0] as Record<string, unknown>;
      return {
        session: {
          id: String(row.s_id),
          sessionToken: row.session_token as string,
          userId: String(row.user_id),
          expires: new Date(row.expires as string | number | Date),
        },
        user: toAdapterUser({
          id: row.u_id,
          email: row.email,
          name: row.name,
          image: row.image,
          email_verified: row.email_verified,
        }),
      };
    },

    async updateSession({ sessionToken, ...data }) {
      if (data.expires) {
        await mysql`
          UPDATE sessions SET expires = ${data.expires}
          WHERE session_token = ${sessionToken}
        `;
      }
      if (data.userId) {
        await mysql`
          UPDATE sessions SET user_id = ${parseInt(data.userId)}
          WHERE session_token = ${sessionToken}
        `;
      }
      const rows = await mysql`
        SELECT id, session_token, user_id, expires
        FROM sessions WHERE session_token = ${sessionToken}
      `;
      return rows[0] ? toAdapterSession(rows[0]) : null;
    },

    async deleteSession(sessionToken) {
      await mysql`
        DELETE FROM sessions WHERE session_token = ${sessionToken}
      `;
    },

    // ── Verification token methods ─────────────────────────────────

    async createVerificationToken({ identifier, token, expires }) {
      await mysql`
        INSERT INTO verification_tokens (identifier, token, expires)
        VALUES (${identifier}, ${token}, ${expires})
      `;
      return { identifier, token, expires };
    },

    async useVerificationToken({ identifier, token }) {
      const rows = await mysql`
        SELECT identifier, token, expires
        FROM verification_tokens
        WHERE identifier = ${identifier} AND token = ${token}
      `;
      if (!rows[0]) return null;

      await mysql`
        DELETE FROM verification_tokens
        WHERE identifier = ${identifier} AND token = ${token}
      `;

      const row = rows[0] as Record<string, unknown>;
      return {
        identifier: row.identifier as string,
        token: row.token as string,
        expires: new Date(row.expires as string | number | Date),
      };
    },
  };
}
