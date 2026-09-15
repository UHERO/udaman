/**
 * RFC 9728 discovery endpoint. Tells Claude that /api/mcp is a protected
 * resource and points at our authorization server. Lets the MCP client find
 * OAuth without us hardcoding URLs on its side.
 */

import { getPublicOrigin } from "@/lib/oauth/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return Response.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: ["mcp"],
    bearer_methods_supported: ["header"],
  });
}
