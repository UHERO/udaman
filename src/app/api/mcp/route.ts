/**
 * The MCP endpoint. resolveAuth() checks for a Bearer token first (via
 * OAuthController.validateBearer) and falls back to NextAuth's cookie
 * session for backward compatibility. On 401, returns a WWW-Authenticate:
 * Bearer header that points at the protected-resource metadata so Claude
 * can discover OAuth automatically. Spins up a fresh McpServer and
 * WebStandardStreamableHTTPServerTransport per request, registers tools
 * with the resolved user context, and cleans up the transport on completion.
 */

import OAuthController from "@catalog/controllers/oauth";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { auth } from "@/lib/auth/index";
import { registerUheroTools } from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuthContext = { userId: string; userEmail: string | null | undefined };

async function resolveAuth(req: Request): Promise<AuthContext | null> {
  // Try OAuth Bearer first.
  const header =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (header) {
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (match) {
      const token = match[1];
      const record = await OAuthController.validateBearer(token);
      if (record) return record.toMcpContext();
      // Bearer present but invalid → fall through to 401
      return null;
    }
  }
  // Fallback: NextAuth cookie (original path).
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, userEmail: session.user.email };
  }
  return null;
}

function unauthorized(req: Request): Response {
  const origin = new URL(req.url).origin;
  const resourceMetadata = `${origin}/.well-known/oauth-protected-resource/api/mcp`;
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: `Unauthorized: connect via OAuth at ${origin} or sign in with your @hawaii.edu account.`,
      },
      id: null,
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer realm="mcp", resource_metadata="${resourceMetadata}"`,
      },
    },
  );
}

async function handle(req: Request): Promise<Response> {
  const ctx = await resolveAuth(req);
  if (!ctx) return unauthorized(req);

  const server = new McpServer({
    name: "uhero-data",
    version: "0.1.0",
  });

  registerUheroTools(server, {
    userId: ctx.userId,
    userEmail: ctx.userEmail,
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(req);
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = handle;
