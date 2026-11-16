/**
 * Catalog MCP: changing the data. Both tools here are generated from the
 * change registry (src/core/ops/change-registry.ts):
 *
 *   propose_change   everyone who may propose: a reviewable change of any
 *                    registered kind
 *   <direct tools>   devs only: one per kind that declares one, applying
 *                    the same change at once
 *
 * A new change kind shows up in both without touching this file.
 */

import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { listChangeKinds } from "@/core/ops/change-kinds";
import { proposalsUrl } from "@/core/ops/links";
import { applyDirect, createProposal } from "@/core/ops/proposals";

import { UNIVERSE as U, wrap, type CallerContext } from "../shared";

export function registerChangeTools(server: McpServer, ctx: CallerContext) {
  const { actor } = ctx;
  const kinds = listChangeKinds();
  const kindNames = kinds.map((k) => k.kind) as [string, ...string[]];

  if (ctx.canPropose) {
    server.registerTool(
      "propose_change",
      {
        title: "Propose a change",
        description:
          "Propose a change for a reviewer to approve. Nothing changes until it is approved. " +
          "One proposal can cover many targets of the same kind (e.g. a whole group of issues with one fix). " +
          "The server records each target's current state, validates, and dry-runs load-statement changes; a failing dry run is refused. " +
          "Kinds:\n" +
          kinds
            .map(
              (k) =>
                `- ${k.kind} (target_id = a ${k.targetType} id): ${k.summary}`,
            )
            .join("\n") +
          "\nFor metadata kinds, set basis: measurement_series (the measurement's series that have a value all agree) or research (found on a source website), and cite where each value came from in evidence. " +
          "issue_id ties the change to an ops issue when there is one; it is optional.",
        inputSchema: {
          kind: z.enum(kindNames),
          summary: z
            .string()
            .min(10)
            .max(500)
            .describe("One line a reviewer reads first"),
          evidence: z
            .string()
            .min(10)
            .max(12000)
            .describe("Why: the cause, what you checked, sources for values"),
          issue_id: z.number().int().optional(),
          basis: z.enum(["measurement_series", "research"]).optional(),
          targets: z
            .array(
              z.object({
                target_id: z.number().int(),
                issue_id: z.number().int().optional(),
                after: z
                  .record(z.string(), z.unknown())
                  .describe("The new values; see the kind for its fields"),
              }),
            )
            .min(1)
            .max(200),
        },
      },
      wrap(
        async (a: {
          kind: string;
          summary: string;
          evidence: string;
          issue_id?: number;
          basis?: "measurement_series" | "research";
          targets: Array<{
            target_id: number;
            issue_id?: number;
            after: Record<string, unknown>;
          }>;
        }) => {
          const r = await createProposal(actor, {
            universe: U,
            issueId: a.issue_id ?? null,
            kind: a.kind,
            summary: a.summary,
            evidence: a.evidence,
            basis: a.basis,
            targets: a.targets.map((t) => ({
              targetId: t.target_id,
              issueId: t.issue_id ?? null,
              after: t.after,
            })),
          });
          return {
            state: r.state,
            proposal_id: r.proposal.id,
            status: r.proposal.status,
            review_url: proposalsUrl(U),
            result: "result" in r ? r.result : undefined,
          };
        },
      ),
    );
  }

  if (ctx.isDev) {
    for (const k of kinds) {
      if (!k.directTool) continue;
      server.registerTool(
        k.directTool.name,
        {
          title: k.directTool.title,
          description: `${k.directTool.description} target_id = a ${k.targetType} id. ${k.summary}`,
          inputSchema: {
            target_id: z.number().int(),
            changes: z
              .record(z.string(), z.unknown())
              .optional()
              .describe("The new values (the kind's `after`)"),
            issue_id: z.number().int().optional(),
          },
        },
        wrap(
          async (a: {
            target_id: number;
            changes?: Record<string, unknown>;
            issue_id?: number;
          }) => {
            const r = await applyDirect(actor, {
              universe: U,
              kind: k.kind,
              targetId: a.target_id,
              after: a.changes ?? {},
              issueId: a.issue_id ?? null,
            });
            return { ok: true, before: r.before, after: r.after };
          },
        ),
      );
    }
  }
}
