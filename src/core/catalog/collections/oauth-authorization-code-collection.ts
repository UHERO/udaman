/**
 * Static class for `oauth_authorization_codes`. `issue()` generates a code,
 * hashes it with SHA-256, and stores only the hash with a 5-minute TTL.
 * `findByCode()` rehashes the input and looks up by hash. `consume(id)`
 * atomically sets `consumed_at` on first call only — returns `true` if this
 * call won the race, `false` otherwise (prevents code replay).
 */

import "server-only";

import { insertAndGetId, mysql } from "@/lib/mysql/db";
import { randomBase64Url, sha256Hex } from "@/lib/oauth/pkce";

import OAuthAuthorizationCode, {
  type OAuthAuthorizationCodeAttrs,
} from "../models/oauth-authorization-code";

export type IssueAuthorizationCodePayload = {
  clientId: string;
  userId: number;
  redirectUri: string;
  scope?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  ttlSeconds?: number;
};

class OAuthAuthorizationCodeCollection {
  static async issue(
    payload: IssueAuthorizationCodePayload,
  ): Promise<{ code: string; record: OAuthAuthorizationCode }> {
    const code = randomBase64Url(32);
    const codeHash = sha256Hex(code);
    const ttl = payload.ttlSeconds ?? 300; // 5 minutes
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const insertId = await insertAndGetId(
      `INSERT INTO oauth_authorization_codes
       (code_hash, client_id, user_id, redirect_uri, scope,
        code_challenge, code_challenge_method, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        codeHash,
        payload.clientId,
        payload.userId,
        payload.redirectUri,
        payload.scope ?? "mcp",
        payload.codeChallenge,
        payload.codeChallengeMethod,
        expiresAt,
      ],
    );

    const rows = await mysql<OAuthAuthorizationCodeAttrs>`
      SELECT * FROM oauth_authorization_codes WHERE id = ${insertId} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error("failed to load newly issued authorization code");
    return { code, record: new OAuthAuthorizationCode(row) };
  }

  static async findByCode(
    code: string,
  ): Promise<OAuthAuthorizationCode | null> {
    const codeHash = sha256Hex(code);
    const rows = await mysql<OAuthAuthorizationCodeAttrs>`
      SELECT * FROM oauth_authorization_codes WHERE code_hash = ${codeHash} LIMIT 1
    `;
    return rows[0] ? new OAuthAuthorizationCode(rows[0]) : null;
  }

  /**
   * Atomically mark a code as consumed. Returns true if this call performed
   * the consume; false if the code was already consumed (race winner elsewhere).
   */
  static async consume(id: number): Promise<boolean> {
    const result = await mysql`
      UPDATE oauth_authorization_codes
      SET consumed_at = NOW()
      WHERE id = ${id} AND consumed_at IS NULL
    `;
    const affected = (result as { affectedRows?: number }).affectedRows ?? 0;
    return affected === 1;
  }
}

export default OAuthAuthorizationCodeCollection;
