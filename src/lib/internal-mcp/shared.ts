/*************************************************************************
 * Shared by the two internal MCP servers and the runner API:
 *
 *   /api/mcp/catalog   work on the data: read, test, propose, (devs) edit
 *   /api/mcp/ops       the workflow around it: issues and the review queue
 *   /api/ops-runner/*  the agent harness's bookkeeping (plain HTTP; the
 *                      model never sees it)
 *
 * Each tool module is a `registerXTools(server, ctx)` function that
 * registers only what the caller may use: a tool that isn't registered
 * can't be called, whatever the model asks for. Moving a domain to its own
 * endpoint later is a routing change, not a rewrite.
 *
 * Callers: UHERO internal/admin/dev staff (OAuth bearer from Claude Code,
 * or a signed-in session), and the ops agent (an `ops_service_tokens`
 * bearer). Network: nginx should only allow the VPN range and the agent
 * workstation for these paths; OPS_MCP_ALLOWED_IPS is a second, optional
 * check in the app (comma-separated exact IPs).
 *************************************************************************/

import "server-only";

import OAuthController from "@catalog/controllers/oauth";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { validateServiceToken } from "@/core/ops/service-tokens";
import { canReview, getOpsSettings } from "@/core/ops/settings";
import type { Actor } from "@/core/ops/types";
import { auth } from "@/lib/auth/index";
import { mysql } from "@/lib/mysql/db";
import { getPublicOrigin } from "@/lib/oauth/origin";

/** v1 scope: the UHERO universe only. */
export const UNIVERSE = "UHERO";

const INTERNAL_ROLES = new Set(["internal", "admin", "dev"]);
const DEV_ROLES = new Set(["admin", "dev"]);

/** Who is calling, and what they may do. Passed to every register function. */
export interface CallerContext {
  actor: Actor;
  isAgent: boolean;
  isDev: boolean;
  /** Devs, admins, and people on the reviewer list. */
  canReview: boolean;
  /**
   * May create proposals: staff always; the agent only once proposals are
   * switched on (off = comment-only mode).
   */
  canPropose: boolean;
}

// ─── Tool result helpers ──────────────────────────────────────────────

export function ok(payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 1) },
    ],
  };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [
      { type: "text" as const, text: JSON.stringify({ error: message }) },
    ],
  };
}

/** Wrap a handler: errors become tool errors, never thrown. */
export function wrap<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return ok(await fn(args));
    } catch (e) {
      return fail(e);
    }
  };
}

// ─── Who is calling ───────────────────────────────────────────────────

async function fetchUser(
  userId: number,
): Promise<{ role: string; email: string } | null> {
  const rows = await mysql<{ role: string; email: string }>`
    SELECT role, email FROM users WHERE id = ${userId} LIMIT 1
  `;
  return rows[0] ?? null;
}

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  return header ? (/^Bearer\s+(\S+)$/i.exec(header)?.[1] ?? null) : null;
}

/** The agent, if the request carries a valid service token. */
export async function resolveAgent(req: Request): Promise<Actor | null> {
  const token = bearer(req);
  const svc = token ? await validateServiceToken(token) : null;
  return svc
    ? {
        type: "agent",
        userId: svc.userId,
        email: svc.email,
        role: "agent",
        via: "agent",
      }
    : null;
}

async function resolveActor(req: Request): Promise<Actor | null> {
  const agent = await resolveAgent(req);
  if (agent) return agent;
  let userId: number | null = null;
  const token = bearer(req);
  if (token) {
    const record = await OAuthController.validateBearer(token);
    if (!record) return null;
    userId = Number(record.toMcpContext().userId);
  } else {
    const session = await auth();
    if (session?.user?.id) userId = Number(session.user.id);
  }
  if (userId == null) return null;
  // The role is read live on every call, never taken from the token.
  const user = await fetchUser(userId);
  return user
    ? { type: "user", userId, email: user.email, role: user.role, via: "mcp" }
    : null;
}

async function contextFor(actor: Actor): Promise<CallerContext> {
  const isAgent = actor.type === "agent";
  return {
    actor,
    isAgent,
    isDev: actor.type === "user" && DEV_ROLES.has(actor.role),
    canReview: await canReview(UNIVERSE, actor),
    canPropose: isAgent
      ? (await getOpsSettings(UNIVERSE)).proposalsEnabled
      : true,
  };
}

function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

/** The optional in-app IP check. Returns false when the caller is refused. */
export function ipAllowed(req: Request): boolean {
  const allowed = process.env.OPS_MCP_ALLOWED_IPS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed?.length) return true;
  const ip = clientIp(req);
  return ip != null && allowed.includes(ip);
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

// ─── Serving an MCP endpoint ──────────────────────────────────────────

/**
 * Build a route handler for one internal MCP server.
 *   name      server name shown to clients
 *   path      the route path, e.g. "/api/mcp/catalog" (for OAuth discovery)
 *   register  registers the tools this caller may use
 */
export function mcpHandler(opts: {
  name: string;
  path: string;
  register: (server: McpServer, ctx: CallerContext) => void;
}) {
  return async function handle(req: Request): Promise<Response> {
    if (!ipAllowed(req)) return jsonError(403, "Forbidden: internal endpoint");

    const actor = await resolveActor(req);
    if (!actor) {
      const origin = getPublicOrigin(req);
      return jsonError(
        401,
        `Unauthorized: connect via OAuth at ${origin} with a UHERO staff account.`,
        {
          "WWW-Authenticate": `Bearer realm="${opts.name}", resource_metadata="${origin}/.well-known/oauth-protected-resource${opts.path}"`,
        },
      );
    }
    if (actor.type === "user" && !INTERNAL_ROLES.has(actor.role)) {
      return jsonError(403, "Forbidden: this MCP is for UHERO internal staff");
    }

    const server = new McpServer({ name: opts.name, version: "0.2.0" });
    opts.register(server, await contextFor(actor));

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
  };
}
