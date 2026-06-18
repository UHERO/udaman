/**
 * Static class for `oauth_access_tokens`. `issue()` mints a 32-byte token
 * with a 30-day TTL, storing only the SHA-256 hash. `findByToken()` rehashes
 * and looks up; only returns rows that are unexpired and unrevoked.
 * `revokeByUser(userId)` bulk-sets `revoked_at` for emergency lockout.
 */

import "server-only";

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
        expiresAt,
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
}

export default OAuthAccessTokenCollection;
