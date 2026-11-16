/**
 * Ops MCP endpoint (/api/mcp/ops): issues and the review queue.
 * See src/lib/internal-mcp/shared.ts for who can call it and how.
 */

import { registerOpsTools } from "@/lib/internal-mcp/ops";
import { mcpHandler } from "@/lib/internal-mcp/shared";

export const runtime = "nodejs";

const handle = mcpHandler({
  name: "udaman-ops",
  path: "/api/mcp/ops",
  register: registerOpsTools,
});

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = handle;
