/**
 * RFC 9728 discovery for the internal ops MCP (/api/mcp/ops), so Claude
 * Code can find the OAuth flow the same way it does for /api/mcp.
 */

import { getPublicOrigin } from "@/lib/oauth/origin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return Response.json({
    resource: `${origin}/api/mcp/ops`,
    authorization_servers: [origin],
    scopes_supported: ["mcp"],
    bearer_methods_supported: ["header"],
  });
}
