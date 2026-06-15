/**
 * Static class that owns DB queries for `oauth_clients`. Implements
 * `register(payload)` (validates redirect URIs require `https://` or
 * `http://localhost`, no URL fragments) and `getByClientId(clientId)`.
 * Generates new `client_id` values as 32 bytes of randomness in base64url.
 */

import "server-only";

import { insertAndGetId, mysql } from "@/lib/mysql/db";
import { randomBase64Url } from "@/lib/oauth/pkce";

import OAuthClient, {
  type OAuthClientAttrs,
} from "../models/oauth-client";

export type RegisterClientPayload = {
  clientName?: string | null;
  redirectUris: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  scope?: string;
};

function validateRedirectUris(uris: string[]): { ok: true } | { ok: false; reason: string } {
  if (!Array.isArray(uris) || uris.length === 0) {
    return { ok: false, reason: "redirect_uris must be a non-empty array" };
  }
  for (const uri of uris) {
    if (typeof uri !== "string") {
      return { ok: false, reason: "every redirect_uri must be a string" };
    }
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      return { ok: false, reason: `redirect_uri is not a valid URL: ${uri}` };
    }
    const isHttps = parsed.protocol === "https:";
    const isLocalhostHttp =
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    if (!isHttps && !isLocalhostHttp) {
      return {
        ok: false,
        reason: `redirect_uri must be https:// or http://localhost(127.0.0.1): ${uri}`,
      };
    }
    if (parsed.hash) {
      return { ok: false, reason: `redirect_uri must not contain a fragment: ${uri}` };
    }
  }
  return { ok: true };
}

class OAuthClientCollection {
  static async register(payload: RegisterClientPayload): Promise<OAuthClient> {
    const validation = validateRedirectUris(payload.redirectUris);
    if (!validation.ok) {
      throw new Error(`invalid_redirect_uri: ${validation.reason}`);
    }

    const clientId = randomBase64Url(32);
    const grantTypes = payload.grantTypes?.length
      ? payload.grantTypes
      : ["authorization_code"];
    const responseTypes = payload.responseTypes?.length
      ? payload.responseTypes
      : ["code"];

    await insertAndGetId(
      `INSERT INTO oauth_clients
       (client_id, client_name, redirect_uris, grant_types, response_types,
        token_endpoint_auth_method, scope, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        clientId,
        payload.clientName ?? null,
        JSON.stringify(payload.redirectUris),
        JSON.stringify(grantTypes),
        JSON.stringify(responseTypes),
        payload.tokenEndpointAuthMethod ?? "none",
        payload.scope ?? "mcp",
      ],
    );

    const fetched = await this.getByClientId(clientId);
    if (!fetched) throw new Error("failed to load newly created oauth client");
    return fetched;
  }

  static async getByClientId(clientId: string): Promise<OAuthClient | null> {
    const rows = await mysql<OAuthClientAttrs>`
      SELECT * FROM oauth_clients WHERE client_id = ${clientId} LIMIT 1
    `;
    return rows[0] ? new OAuthClient(rows[0]) : null;
  }
}

export default OAuthClientCollection;
