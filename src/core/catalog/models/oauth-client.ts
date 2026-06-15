/**
 * Model for a registered OAuth client (one row per Claude installation).
 * Parses JSON columns (`redirect_uris`, `grant_types`, `response_types`) into
 * string arrays; exposes `redirectUriAllowed()` and `supportsGrant()` helpers,
 * plus `toRegistrationResponse()` for the dynamic-registration endpoint.
 */

export type OAuthClientAttrs = {
  id: number;
  client_id: string;
  client_name?: string | null;
  redirect_uris: unknown;
  grant_types: unknown;
  response_types: unknown;
  token_endpoint_auth_method?: string | null;
  scope?: string | null;
  created_at?: Date | string | null;
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

class OAuthClient {
  readonly id: number;
  readonly clientId: string;
  clientName: string | null;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
  scope: string;
  createdAt: Date | null;

  constructor(attrs: OAuthClientAttrs) {
    this.id = attrs.id;
    this.clientId = attrs.client_id;
    this.clientName = attrs.client_name ?? null;
    this.redirectUris = asStringArray(attrs.redirect_uris);
    this.grantTypes = asStringArray(attrs.grant_types);
    this.responseTypes = asStringArray(attrs.response_types);
    this.tokenEndpointAuthMethod = attrs.token_endpoint_auth_method ?? "none";
    this.scope = attrs.scope ?? "mcp";
    this.createdAt = attrs.created_at ? new Date(attrs.created_at as string | Date) : null;
  }

  redirectUriAllowed(uri: string): boolean {
    return this.redirectUris.includes(uri);
  }

  supportsGrant(grant: string): boolean {
    return this.grantTypes.includes(grant);
  }

  toRegistrationResponse() {
    return {
      client_id: this.clientId,
      client_id_issued_at: this.createdAt ? Math.floor(this.createdAt.getTime() / 1000) : 0,
      client_name: this.clientName ?? undefined,
      redirect_uris: this.redirectUris,
      grant_types: this.grantTypes,
      response_types: this.responseTypes,
      token_endpoint_auth_method: this.tokenEndpointAuthMethod,
      scope: this.scope,
    };
  }

  toString(): string {
    return `OAuthClient(${this.clientName ?? "unnamed"} / ${this.clientId})`;
  }

  toJSON() {
    return this.toRegistrationResponse();
  }
}

export default OAuthClient;
