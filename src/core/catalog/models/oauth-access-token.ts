/**
 * Model for a 30-day Bearer access token. Exposes `isUsable()` (combines
 * expiry + revocation checks) and `toMcpContext()` which produces the
 * `{ userId, userEmail }` shape the MCP route hands to tool registration.
 */

import { hstToInstant } from "../utils/time";

export type OAuthAccessTokenAttrs = {
  id: number;
  token_hash: string;
  client_id: string;
  user_id: number;
  user_email: string;
  scope?: string | null;
  expires_at: Date | string;
  revoked_at?: Date | string | null;
  created_at?: Date | string | null;
};

class OAuthAccessToken {
  readonly id: number;
  readonly tokenHash: string;
  readonly clientId: string;
  readonly userId: number;
  readonly userEmail: string;
  readonly scope: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date | null;

  constructor(attrs: OAuthAccessTokenAttrs) {
    this.id = attrs.id;
    this.tokenHash = attrs.token_hash;
    this.clientId = attrs.client_id;
    this.userId = attrs.user_id;
    this.userEmail = attrs.user_email;
    this.scope = attrs.scope ?? "mcp";
    // expires_at holds HST wall-clock — convert to a true instant so
    // isExpired() compares correctly against new Date()
    this.expiresAt = hstToInstant(attrs.expires_at as string | Date);
    this.revokedAt = attrs.revoked_at
      ? new Date(attrs.revoked_at as string | Date)
      : null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
  }

  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isUsable(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  toMcpContext(): { userId: string; userEmail: string } {
    return { userId: String(this.userId), userEmail: this.userEmail };
  }

  toString(): string {
    return `OAuthAccessToken(user=${this.userId} client=${this.clientId})`;
  }
}

export default OAuthAccessToken;
