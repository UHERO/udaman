/**
 * RFC 8414 discovery endpoint. Returns JSON with the authorization, token,
 * and registration endpoints, supported grant/response types, PKCE methods
 * (S256), and scope. The `issuer` is derived from the request origin so
 * deployments work behind any host.
 */

import { getPublicOrigin } from "@/lib/oauth/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return Response.json({
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  });
}
