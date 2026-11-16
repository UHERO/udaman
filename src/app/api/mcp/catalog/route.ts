/**
 * Catalog MCP endpoint (/api/mcp/catalog): read, test and change the
 * catalog along approved channels. Separate from the public uhero-data MCP
 * at /api/mcp. See src/lib/internal-mcp/shared.ts for who can call it.
 */

import { registerCatalogTools } from "@/lib/internal-mcp/catalog";
import { mcpHandler } from "@/lib/internal-mcp/shared";

export const runtime = "nodejs";

const handle = mcpHandler({
  name: "udaman-catalog",
  path: "/api/mcp/catalog",
  register: registerCatalogTools,
});

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = handle;
