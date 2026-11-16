/*************************************************************************
 * Ops service tokens: long-lived bearer tokens that authenticate the agent
 * to /api/mcp/ops. Only the SHA-256 hash is stored; the plaintext is shown
 * once at creation. A caller authenticated this way is the agent actor,
 * whatever its user's role.
 *************************************************************************/

import crypto from "node:crypto";

import { mysql } from "@database/mysql";

// Local copies of the pkce helpers: that module is `server-only`, and this
// one also runs in the worker and the ops CLI.
const sha256Hex = (s: string) =>
  crypto.createHash("sha256").update(s).digest("hex");
const randomBase64Url = (bytes: number) =>
  crypto.randomBytes(bytes).toString("base64url");

export const AGENT_EMAIL =
  process.env.OPS_AGENT_EMAIL ?? "udaman-agent@uhero.hawaii.edu";

/** Prefix so the token type is recognizable in configs and logs. */
const PREFIX = "uops_";

export async function getAgentUserId(): Promise<number | null> {
  const rows = await mysql<{ id: number }>`
    SELECT id FROM users WHERE email = ${AGENT_EMAIL} LIMIT 1
  `;
  return rows[0] ? Number(rows[0].id) : null;
}

export async function createServiceToken(
  name: string,
  createdByUserId: number,
): Promise<{ id: number; token: string }> {
  const userId = await getAgentUserId();
  if (!userId) {
    throw new Error(
      `Agent user ${AGENT_EMAIL} not found; apply the ops_agent migration first`,
    );
  }
  const token = `${PREFIX}${randomBase64Url(32)}`;
  await mysql`
    INSERT INTO ops_service_tokens (name, token_hash, user_id, created_by_user_id, created_at)
    VALUES (${name.slice(0, 255)}, ${sha256Hex(token)}, ${userId}, ${createdByUserId}, NOW())
  `;
  const rows = await mysql<{ id: number }>`
    SELECT id FROM ops_service_tokens WHERE token_hash = ${sha256Hex(token)} LIMIT 1
  `;
  return { id: Number(rows[0].id), token };
}

export async function validateServiceToken(
  token: string,
): Promise<{ userId: number; email: string } | null> {
  if (!token.startsWith(PREFIX)) return null;
  const rows = await mysql<{ id: number; user_id: number; email: string }>`
    SELECT t.id, t.user_id, u.email
    FROM ops_service_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ${sha256Hex(token)} AND t.revoked_at IS NULL
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  void mysql`UPDATE ops_service_tokens SET last_used_at = NOW() WHERE id = ${r.id}`;
  return { userId: Number(r.user_id), email: r.email };
}

export async function listServiceTokens() {
  return mysql<{
    id: number;
    name: string;
    created_at: Date | string;
    last_used_at: Date | string | null;
    revoked_at: Date | string | null;
    created_by: string | null;
  }>`
    SELECT t.id, t.name, t.created_at, t.last_used_at, t.revoked_at,
           u.email AS created_by
    FROM ops_service_tokens t
    LEFT JOIN users u ON u.id = t.created_by_user_id
    ORDER BY t.id DESC
  `;
}

export async function revokeServiceToken(id: number): Promise<void> {
  await mysql`
    UPDATE ops_service_tokens SET revoked_at = NOW()
    WHERE id = ${id} AND revoked_at IS NULL
  `;
}
