/**
 * Internal ops MCP endpoint (/api/mcp/ops). Separate from the public
 * uhero-data MCP at /api/mcp: this one reads and changes the catalog along
 * approved channels (docs/2026-11-13-ops-agent-design.md).
 *
 * Who can call it:
 *   - the ops agent, with an `ops_service_tokens` bearer token (uops_…)
 *   - UHERO internal/admin/dev staff, with the usual OAuth bearer token
 *     (Claude Code) or a signed-in session cookie
 * Network: nginx should only allow the VPN range and the agent
 * workstation for this path. OPS_MCP_ALLOWED_IPS is a second, optional
 * check in the app (comma-separated exact IPs).
 */

import OAuthController from "@catalog/controllers/oauth";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { validateServiceToken } from "@/core/ops/service-tokens";
import { canReview, getOpsSettings } from "@/core/ops/settings";
import type { Actor } from "@/core/ops/types";
import { auth } from "@/lib/auth/index";
import { mysql } from "@/lib/mysql/db";
import { getPublicOrigin } from "@/lib/oauth/origin";
import { OPS_UNIVERSE, registerOpsTools } from "@/lib/ops-mcp/tools";

export const runtime = "nodejs";

const INTERNAL_ROLES = new Set(["internal", "admin", "dev"]);
const DEV_ROLES = new Set(["admin", "dev"]);

async function fetchUser(
  userId: number,
): Promise<{ role: string; universe: string; email: string } | null> {
  const rows = await mysql<{ role: string; universe: string; email: string }>`
    SELECT role, universe, email FROM users WHERE id = ${userId} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function resolveActor(req: Request): Promise<Actor | null> {
  const header = req.headers.get("authorization");
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  if (match) {
    const token = match[1];
    const svc = await validateServiceToken(token);
    if (svc) {
      return {
        type: "agent",
        userId: svc.userId,
        email: svc.email,
        role: "agent",
        via: "agent",
      };
    }
    const record = await OAuthController.validateBearer(token);
    if (!record) return null;
    const ctx = record.toMcpContext();
    const user = await fetchUser(Number(ctx.userId));
    if (!user) return null;
    return {
      type: "user",
      userId: Number(ctx.userId),
      email: user.email,
      role: user.role,
      via: "mcp",
    };
  }
  const session = await auth();
  if (session?.user?.id) {
    const user = await fetchUser(Number(session.user.id));
    if (!user) return null;
    return {
      type: "user",
      userId: Number(session.user.id),
      email: user.email,
      role: user.role,
      via: "mcp",
    };
  }
  return null;
}

function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

function jsonError(
  status: number,
  message: string,
  headers: Record<string, string> = {},
) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message },
      id: null,
    }),
    { status, headers: { "Content-Type": "application/json", ...headers } },
  );
}

async function handle(req: Request): Promise<Response> {
  const allowed = process.env.OPS_MCP_ALLOWED_IPS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed?.length) {
    const ip = clientIp(req);
    if (!ip || !allowed.includes(ip))
      return jsonError(403, "Forbidden: internal endpoint");
  }

  const actor = await resolveActor(req);
  if (!actor) {
    const origin = getPublicOrigin(req);
    return jsonError(
      401,
      `Unauthorized: connect via OAuth at ${origin} with a UHERO staff account.`,
      {
        "WWW-Authenticate": `Bearer realm="mcp-ops", resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp/ops"`,
      },
    );
  }
  if (actor.type === "user" && !INTERNAL_ROLES.has(actor.role)) {
    return jsonError(403, "Forbidden: the ops MCP is for UHERO internal staff");
  }

  const server = new McpServer({ name: "udaman-ops", version: "0.1.0" });
  registerOpsTools(server, {
    actor,
    isAgent: actor.type === "agent",
    isDev: actor.type === "user" && DEV_ROLES.has(actor.role),
    canReview: await canReview(OPS_UNIVERSE, actor),
    agentCanPropose: (await getOpsSettings(OPS_UNIVERSE)).proposalsEnabled,
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
