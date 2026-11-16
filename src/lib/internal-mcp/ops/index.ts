/**
 * The ops MCP (/api/mcp/ops): the workflow around the data. What's broken,
 * what's been tried, and what's waiting for review. The agent always
 * connects to it; staff add it if they work issues or review proposals.
 *
 *   issues   list_issues, get_issue, comment_on_issue, resolve_issue,
 *            snooze_issue, raise_issue, assign_issue (people),
 *            dismiss_issue and reopen_issue (devs)
 *   review   list_proposals, review_proposal (reviewers)
 */

import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { CallerContext } from "../shared";
import { registerIssueTools } from "./issues";
import { registerReviewTools } from "./review";

export function registerOpsTools(server: McpServer, ctx: CallerContext) {
  registerIssueTools(server, ctx);
  registerReviewTools(server, ctx);
}
