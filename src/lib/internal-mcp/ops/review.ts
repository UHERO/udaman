/** Ops MCP: the review queue. Proposals are made on the catalog MCP. */

import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { ProposalStore } from "@/core/ops/proposal-store";
import { reviewProposal } from "@/core/ops/proposals";

import { UNIVERSE as U, wrap, type CallerContext } from "../shared";

export function registerReviewTools(server: McpServer, ctx: CallerContext) {
  const { actor } = ctx;

  server.registerTool(
    "list_proposals",
    {
      title: "List proposals",
      description:
        "Proposed changes and their review state. pending = shown for review now; queued = ready behind it.",
      inputSchema: {
        status: z
          .array(
            z.enum([
              "queued",
              "pending",
              "approved",
              "applied",
              "failed",
              "rejected",
              "superseded",
              "stale",
              "withdrawn",
            ]),
          )
          .optional(),
      },
    },
    wrap(
      async ({
        status,
      }: {
        status?: Array<
          | "queued"
          | "pending"
          | "approved"
          | "applied"
          | "failed"
          | "rejected"
          | "superseded"
          | "stale"
          | "withdrawn"
        >;
      }) =>
        (
          await ProposalStore.list({
            universe: U,
            status: status ?? ["queued", "pending"],
          })
        ).map((p) => ({
          id: p.id,
          kind: p.kind,
          status: p.status,
          summary: p.summary,
          targets: p.targets,
          issue_id: p.issueId,
          created_at: p.createdAt,
          review_note: p.reviewNote,
        })),
    ),
  );

  if (ctx.canReview) {
    server.registerTool(
      "review_proposal",
      {
        title: "Approve or reject a proposal",
        description:
          "Reviewers only. Approving applies the change (each target re-checked for edits since it was proposed).",
        inputSchema: {
          id: z.number().int(),
          decision: z.enum(["approve", "reject"]),
          note: z.string().max(2000).optional(),
        },
      },
      wrap(
        async (a: {
          id: number;
          decision: "approve" | "reject";
          note?: string;
        }) => {
          const p = await reviewProposal(
            a.id,
            actor,
            a.decision,
            a.note ?? null,
          );
          return { id: p.id, status: p.status };
        },
      ),
    );
  }
}
