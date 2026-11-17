/**
 * The catalog MCP (/api/mcp/catalog): the server anyone connects to when
 * they want to work on data, whether that's the agent or a staff member in
 * Claude Code.
 *
 *   read     get_series, find_series, list_lookup, get_measurement,
 *            get_loader, get_reload_jobs, get_app_logs
 *   test     check_eval, dry_run_loader, probe_source_url
 *   change   propose_change (everyone); direct edit tools (devs)
 *
 * A new domain adds a register function here, its change kinds to the
 * registry, and optionally a detector.
 */

import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { CallerContext } from "../shared";
import { registerChangeTools } from "./changes";
import { registerLoaderTools } from "./loaders";
import { registerMeasurementTools } from "./measurements";
import { registerSeriesTools } from "./series";
import { registerSourceTools } from "./sources";

export function registerCatalogTools(server: McpServer, ctx: CallerContext) {
  registerSeriesTools(server, ctx);
  registerMeasurementTools(server, ctx);
  registerLoaderTools(server, ctx);
  registerSourceTools(server, ctx);
  registerChangeTools(server, ctx);
}
