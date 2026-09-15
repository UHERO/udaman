/**
 * Static class for `oauth_access_tokens`. `issue()` mints a 32-byte token
 * with a 30-day TTL, storing only the SHA-256 hash. `findByToken()` rehashes
 * and looks up; only returns rows that are unexpired and unrevoked.
 * `revokeByUser(userId)` bulk-sets `revoked_at` for emergency lockout;
 * `revokeById(id)` revokes one. `listActive()` joins users and oauth_clients
 * for the admin "MCP Connections" tab.
 */

import { formatHst, toHstSql } from "@catalog/utils/time";

import { insertAndGetId, mysql } from "@/lib/mysql/db";
import { randomBase64Url, sha256Hex } from "@/lib/oauth/pkce";

import OAuthAccessToken, {
  type OAuthAccessTokenAttrs,
} from "../models/oauth-access-token";

export type IssueAccessTokenPayload = {
  clientId: string;
  userId: number;
  userEmail: string;
  scope?: string;
  ttlSeconds?: number;
};

/**
 * One row of the admin connections list. Plain JSON (no Date objects) so it
 * can cross the server-action boundary. Timestamps are naive Hawaii
 * wall-clock strings ("YYYY-MM-DD HH:MM:SS") exactly as the DATETIME columns
 * hold them, which `formatHst` renders without any further conversion.
 */
export type ActiveTokenRow = {
  id: number;
  userId: number;
  /** Email stored on the token at issue time (survives a user edit). */
  tokenEmail: string;
  /** Current email/name from `users`; null if the account was deleted. */
  userEmail: string | null;
  userName: string | null;
  clientId: string;
  clientName: string | null;
  scope: string;
  createdAt: string | null;
  expiresAt: string;
};

type ActiveTokenSqlRow = {
  id: number;
  user_id: number;
  token_email: string;
  user_email: string | null;
  user_name: string | null;
  client_id: string;
  client_name: string | null;
  scope: string | null;
  created_at: Date | string | null;
  expires_at: Date | string;
};

/** HST wall-clock DATETIME (driver Date or string) → naive wall-clock string. */
function hstWallClock(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const s = formatHst(value, "yyyy-MM-dd HH:mm:ss");
  return s === "-" ? null : s;
}

class OAuthAccessTokenCollection {
  static async issue(
    payload: IssueAccessTokenPayload,
  ): Promise<{ token: string; record: OAuthAccessToken; expiresIn: number }> {
    const token = randomBase64Url(32);
    const tokenHash = sha256Hex(token);
    const ttl = payload.ttlSeconds ?? 60 * 60 * 24 * 30; // 30 days
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const insertId = await insertAndGetId(
      `INSERT INTO oauth_access_tokens
       (token_hash, client_id, user_id, user_email, scope, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        tokenHash,
        payload.clientId,
        payload.userId,
        payload.userEmail,
        payload.scope ?? "mcp",
        toHstSql(expiresAt),
      ],
    );

    const rows = await mysql<OAuthAccessTokenAttrs>`
      SELECT * FROM oauth_access_tokens WHERE id = ${insertId} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error("failed to load newly issued access token");
    return { token, record: new OAuthAccessToken(row), expiresIn: ttl };
  }

  static async findByToken(token: string): Promise<OAuthAccessToken | null> {
    const tokenHash = sha256Hex(token);
    const rows = await mysql<OAuthAccessTokenAttrs>`
      SELECT * FROM oauth_access_tokens
      WHERE token_hash = ${tokenHash}
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `;
    return rows[0] ? new OAuthAccessToken(rows[0]) : null;
  }

  static async revokeByUser(userId: number): Promise<void> {
    await mysql`
      UPDATE oauth_access_tokens
      SET revoked_at = NOW()
      WHERE user_id = ${userId} AND revoked_at IS NULL
    `;
  }

  /** Revoke a single token. Returns true if a live token was revoked. */
  static async revokeById(id: number): Promise<boolean> {
    const result = await mysql`
      UPDATE oauth_access_tokens
      SET revoked_at = NOW()
      WHERE id = ${id} AND revoked_at IS NULL
    `;
    const affected = (result as unknown as { affectedRows?: number })
      .affectedRows;
    return affected === undefined ? true : affected > 0;
  }

  /**
   * Every unexpired, unrevoked token, newest first, with the owning user's
   * current name/email and the registering client's name. LEFT JOINs so a
   * token whose user or client row has since vanished still shows up — that
   * is exactly the kind of token an admin wants to see and revoke.
   */
  static async listActive(): Promise<ActiveTokenRow[]> {
    const rows = await mysql<ActiveTokenSqlRow>`
      SELECT t.id,
             t.user_id,
             t.user_email AS token_email,
             u.email      AS user_email,
             u.name       AS user_name,
             t.client_id,
             c.client_name,
             t.scope,
             t.created_at,
             t.expires_at
      FROM oauth_access_tokens t
      LEFT JOIN users u         ON u.id = t.user_id
      LEFT JOIN oauth_clients c ON c.client_id = t.client_id
      WHERE t.revoked_at IS NULL
        AND t.expires_at > NOW()
      ORDER BY t.created_at DESC, t.id DESC
    `;
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      tokenEmail: r.token_email,
      userEmail: r.user_email,
      userName: r.user_name,
      clientId: r.client_id,
      clientName: r.client_name,
      scope: r.scope ?? "mcp",
      createdAt: hstWallClock(r.created_at),
      expiresAt: hstWallClock(r.expires_at) ?? "",
    }));
  }
}

export default OAuthAccessTokenCollection;
