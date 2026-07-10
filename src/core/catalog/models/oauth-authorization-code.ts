/**
 * Model for a one-time OAuth authorization code. Exposes `isExpired()`,
 * `isConsumed()`, and `verifyPkce(verifier)` which delegates to the PKCE
 * helper. Codes are write-once: the consumed flag is set atomically by the
 * collection on first use to prevent replay.
 */

import { verifyPkceChallenge } from "@/lib/oauth/pkce";

export type OAuthAuthorizationCodeAttrs = {
  id: number;
  code_hash: string;
  client_id: string;
  user_id: number;
  redirect_uri: string;
  scope?: string | null;
  code_challenge: string;
  code_challenge_method?: string | null;
  expires_at: Date | string;
  consumed_at?: Date | string | null;
  created_at?: Date | string | null;
};

class OAuthAuthorizationCode {
  readonly id: number;
  readonly codeHash: string;
  readonly clientId: string;
  readonly userId: number;
  readonly redirectUri: string;
  readonly scope: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date | null;

  constructor(attrs: OAuthAuthorizationCodeAttrs) {
    this.id = attrs.id;
    this.codeHash = attrs.code_hash;
    this.clientId = attrs.client_id;
    this.userId = attrs.user_id;
    this.redirectUri = attrs.redirect_uri;
    this.scope = attrs.scope ?? "mcp";
    this.codeChallenge = attrs.code_challenge;
    this.codeChallengeMethod = attrs.code_challenge_method ?? "S256";
    this.expiresAt = new Date(attrs.expires_at as string | Date);
    this.consumedAt = attrs.consumed_at
      ? new Date(attrs.consumed_at as string | Date)
      : null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
  }

  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isConsumed(): boolean {
    return this.consumedAt !== null;
  }

  verifyPkce(verifier: string) {
    return verifyPkceChallenge(
      verifier,
      this.codeChallenge,
      this.codeChallengeMethod,
    );
  }

  toString(): string {
    return `OAuthAuthorizationCode(user=${this.userId} client=${this.clientId})`;
  }
}

export default OAuthAuthorizationCode;
