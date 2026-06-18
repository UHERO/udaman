/**
 * Orchestration layer between OAuth routes and collections. Four entry points:
 *   - registerClient(payload)  : wraps client registration
 *   - authorize(params)        : validates client/redirect/PKCE inputs, checks
 *                                the @hawaii.edu whitelist, issues a one-time
 *                                authorization code
 *   - exchangeCode(params)     : validates the code (existence, expiry,
 *                                single-use, client binding, redirect match),
 *                                verifies PKCE, atomically consumes the code,
 *                                issues the access token. Per RFC 6749 §10.5,
 *                                a reused code revokes all of that user's tokens.
 *   - validateBearer(token)    : used by /api/mcp to authenticate Bearer
 *                                tokens; re-checks the whitelist on every call.
 *
 * All failures throw a typed OAuthError so routes can render RFC-compliant JSON.
 */

import "server-only";

import { isEmailAllowed } from "@/lib/auth/auth-whitelist";

import OAuthAccessTokenCollection from "../collections/oauth-access-token-collection";
import OAuthAuthorizationCodeCollection from "../collections/oauth-authorization-code-collection";
import OAuthClientCollection, {
  type RegisterClientPayload,
} from "../collections/oauth-client-collection";
import type OAuthAccessToken from "../models/oauth-access-token";
import type OAuthClient from "../models/oauth-client";

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope?: string;
  userId: number;
  userEmail: string;
};

export type ExchangeCodeParams = {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
};

export type OAuthError = {
  error:
    | "invalid_request"
    | "invalid_client"
    | "invalid_grant"
    | "unauthorized_client"
    | "unsupported_grant_type"
    | "invalid_scope"
    | "access_denied"
    | "server_error";
  error_description?: string;
};

class OAuthController {
  static async registerClient(payload: RegisterClientPayload): Promise<OAuthClient> {
    return OAuthClientCollection.register(payload);
  }

  /**
   * Issue an authorization code for a signed-in, whitelisted user. Throws an
   * OAuthError on failure so the route can render the right OAuth redirect/error.
   */
  static async authorize(
    params: AuthorizeParams,
  ): Promise<{ code: string; redirectTo: string }> {
    const client = await OAuthClientCollection.getByClientId(params.clientId);
    if (!client) {
      throw { error: "invalid_client", error_description: "unknown client_id" } satisfies OAuthError;
    }
    if (!client.redirectUriAllowed(params.redirectUri)) {
      throw {
        error: "invalid_request",
        error_description: "redirect_uri not registered for this client",
      } satisfies OAuthError;
    }
    if (params.codeChallengeMethod !== "S256") {
      throw {
        error: "invalid_request",
        error_description: "code_challenge_method must be S256",
      } satisfies OAuthError;
    }
    if (!params.codeChallenge) {
      throw {
        error: "invalid_request",
        error_description: "code_challenge is required",
      } satisfies OAuthError;
    }
    if (!isEmailAllowed(params.userEmail)) {
      throw {
        error: "access_denied",
        error_description: "user email is not on the access whitelist",
      } satisfies OAuthError;
    }

    const { code } = await OAuthAuthorizationCodeCollection.issue({
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      scope: params.scope ?? "mcp",
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
    });

    return { code, redirectTo: params.redirectUri };
  }

  /**
   * Validate + atomically consume an authorization code, then issue an access
   * token. Throws OAuthError on any failure so /token can return RFC 6749 JSON.
   */
  static async exchangeCode(
    params: ExchangeCodeParams,
  ): Promise<{ accessToken: string; expiresIn: number; scope: string }> {
    const record = await OAuthAuthorizationCodeCollection.findByCode(params.code);
    if (!record) {
      throw { error: "invalid_grant", error_description: "code not found" } satisfies OAuthError;
    }
    if (record.isConsumed()) {
      // Per RFC 6749 §10.5, if a code is reused, revoke any tokens issued
      // from prior exchange of the same code. Defensive cleanup.
      await OAuthAccessTokenCollection.revokeByUser(record.userId);
      throw { error: "invalid_grant", error_description: "code already used" } satisfies OAuthError;
    }
    if (record.isExpired()) {
      throw { error: "invalid_grant", error_description: "code expired" } satisfies OAuthError;
    }
    if (record.clientId !== params.clientId) {
      throw {
        error: "invalid_grant",
        error_description: "code was not issued to this client",
      } satisfies OAuthError;
    }
    if (record.redirectUri !== params.redirectUri) {
      throw {
        error: "invalid_grant",
        error_description: "redirect_uri does not match the one used at /authorize",
      } satisfies OAuthError;
    }

    const pkce = record.verifyPkce(params.codeVerifier);
    if (!pkce.ok) {
      throw {
        error: "invalid_grant",
        error_description: `PKCE verification failed (${pkce.reason})`,
      } satisfies OAuthError;
    }

    const consumed = await OAuthAuthorizationCodeCollection.consume(record.id);
    if (!consumed) {
      // Lost the race with a concurrent exchange.
      throw {
        error: "invalid_grant",
        error_description: "code already used",
      } satisfies OAuthError;
    }

    // Look up the user email for the access-token row. We don't store email
    // on the code; we'll fetch it from users.
    const userEmail = await fetchUserEmail(record.userId);
    if (!userEmail) {
      throw {
        error: "invalid_grant",
        error_description: "user no longer exists",
      } satisfies OAuthError;
    }
    if (!isEmailAllowed(userEmail)) {
      throw {
        error: "access_denied",
        error_description: "user email is not on the access whitelist",
      } satisfies OAuthError;
    }

    const { token, expiresIn } = await OAuthAccessTokenCollection.issue({
      clientId: record.clientId,
      userId: record.userId,
      userEmail,
      scope: record.scope,
    });

    return { accessToken: token, expiresIn, scope: record.scope };
  }

  static async validateBearer(token: string): Promise<OAuthAccessToken | null> {
    if (!token) return null;
    const record = await OAuthAccessTokenCollection.findByToken(token);
    if (!record || !record.isUsable()) return null;
    if (!isEmailAllowed(record.userEmail)) return null;
    return record;
  }
}

async function fetchUserEmail(userId: number): Promise<string | null> {
  // Local import to avoid pulling mysql into the model layer.
  const { mysql } = await import("@/lib/mysql/db");
  const rows = await mysql<{ email: string }>`
    SELECT email FROM users WHERE id = ${userId} LIMIT 1
  `;
  return rows[0]?.email ?? null;
}

export default OAuthController;
