/**
 * Ops MCP: issues. What is broken, what has been tried, and who is acting.
 * Reading and changing the data itself is on the catalog MCP.
 */

import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { IssueStore } from "@/core/ops/issue-store";
import {
  assignIssue,
  commentOnIssue,
  dismissIssue,
  raiseFinding,
  reopenIssue,
  resolveIssue,
  snoozeIssue,
} from "@/core/ops/issues";
import { issueUrl } from "@/core/ops/links";
import { ProposalStore } from "@/core/ops/proposal-store";
import type { IssueKind, IssueStatus } from "@/core/ops/types";

import { UNIVERSE as U, wrap, type CallerContext } from "../shared";

const STATUS = z.enum([
  "open",
  "investigating",
  "awaiting_human",
  "resolving",
  "resolved",
  "closed",
  "dismissed",
]);
const KIND = z.enum([
  "load_error",
  "reload_job_failed",
  "missing_metadata",
  "quarantined",
  "loader_lag",
  "agent_finding",
]);

export function registerIssueTools(server: McpServer, ctx: CallerContext) {
  const { actor } = ctx;

  server.registerTool(
    "list_issues",
    {
      title: "List ops issues",
      description:
        "List data-loading issues (load errors, loaders past their lag limit, failed reload jobs, missing metadata, findings). " +
        "Defaults to live issues. Each issue has a group_key: issues sharing it usually share a cause and a fix.",
      inputSchema: {
        status: z
          .array(STATUS)
          .optional()
          .describe("Default: open, investigating, awaiting_human, resolving"),
        kind: z.array(KIND).optional(),
        group_key: z.string().optional(),
        search: z.string().optional().describe("Substring of title or summary"),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    wrap(
      async (a: {
        status?: IssueStatus[];
        kind?: IssueKind[];
        group_key?: string;
        search?: string;
        limit?: number;
        offset?: number;
      }) => {
        const res = await IssueStore.list({
          universe: U,
          status: a.status ?? [
            "open",
            "investigating",
            "awaiting_human",
            "resolving",
          ],
          kind: a.kind,
          groupKey: a.group_key,
          search: a.search,
          limit: a.limit ?? 50,
          offset: a.offset,
        });
        return {
          total: res.total,
          issues: res.rows.map((i) => ({
            id: i.id,
            kind: i.kind,
            status: i.status,
            severity: i.severity,
            owner: i.owner,
            title: i.title,
            group_key: i.groupKey,
            subject: `${i.subjectType}:${i.subjectId}${i.subjectField ? `:${i.subjectField}` : ""}`,
            first_seen_at: i.firstSeenAt,
            url: issueUrl(U, i.id),
          })),
        };
      },
    ),
  );

  server.registerTool(
    "get_issue",
    {
      title: "Get an ops issue",
      description:
        "One issue with its full timeline (from Slack, the app, MCP and the agent), its proposals, and how many other issues share its group.",
      inputSchema: { id: z.number().int() },
    },
    wrap(async ({ id }: { id: number }) => {
      const issue = await IssueStore.getById(id);
      if (!issue) throw new Error(`Issue ${id} not found`);
      const [events, proposals, group] = await Promise.all([
        IssueStore.listEvents(id),
        ProposalStore.list({ universe: U, issueId: id, limit: 20 }),
        issue.groupKey
          ? IssueStore.list({
              universe: U,
              groupKey: issue.groupKey,
              status: ["open", "investigating", "awaiting_human", "resolving"],
              limit: 200,
            })
          : Promise.resolve({ rows: [], total: 0 }),
      ]);
      return {
        issue,
        url: issueUrl(U, id),
        events: events.map((e) => ({
          at: e.createdAt,
          type: e.type,
          actor:
            e.actorType === "user"
              ? (e.actorEmail ?? `user ${e.actorUserId}`)
              : e.actorType,
          via: e.via,
          body: e.body,
          payload: e.payload,
        })),
        proposals: proposals.map((p) => ({
          id: p.id,
          kind: p.kind,
          status: p.status,
          summary: p.summary,
          review_note: p.reviewNote,
          targets: p.targets.length,
        })),
        group: { total: group.total, issue_ids: group.rows.map((r) => r.id) },
      };
    }),
  );

  server.registerTool(
    "comment_on_issue",
    {
      title: "Comment on an issue",
      description:
        "Add to an issue's timeline. kind='diagnosis' also sets the issue summary (use it for your conclusion about the cause). " +
        "kind='question' asks a person: it posts in Slack and hands the issue to a human until someone answers.",
      inputSchema: {
        id: z.number().int(),
        body: z.string().min(1).max(8000),
        kind: z.enum(["comment", "diagnosis", "question"]).optional(),
      },
    },
    wrap(
      async (a: {
        id: number;
        body: string;
        kind?: "comment" | "diagnosis" | "question";
      }) => {
        await commentOnIssue(a.id, actor, a.body, a.kind ?? "comment");
        return { ok: true };
      },
    ),
  );

  server.registerTool(
    "resolve_issue",
    {
      title: "Resolve an issue",
      description:
        "Ask for an issue to be resolved. The server re-checks the condition: resolved if it's gone; for a load error " +
        "that still shows its old error, a verification reload may be queued (state 'pending'); otherwise 'rejected'. " +
        "Use after fixing something yourself, or to confirm a fix someone made.",
      inputSchema: {
        id: z.number().int(),
        note: z.string().max(2000).optional(),
      },
    },
    wrap(async (a: { id: number; note?: string }) => {
      const r = await resolveIssue(a.id, actor, a.note ?? null);
      return {
        state: r.state,
        status: r.issue.status,
        message: "message" in r ? r.message : undefined,
      };
    }),
  );

  server.registerTool(
    "snooze_issue",
    {
      title: "Snooze an issue",
      description:
        "Hide an issue from the agent's work queue for N days, e.g. while waiting on a source to publish. People: 1–90 days. The agent: at most 14, with the reason.",
      inputSchema: {
        id: z.number().int(),
        days: z.number().int().min(1).max(90),
        reason: z.string().min(1),
      },
    },
    wrap(async (a: { id: number; days: number; reason: string }) => {
      const days = ctx.isAgent ? Math.min(a.days, 14) : a.days;
      await snoozeIssue(a.id, actor, days, a.reason);
      return { ok: true, days };
    }),
  );

  server.registerTool(
    "raise_issue",
    {
      title: "Raise a finding",
      description:
        "Record a problem the detectors can't see (a code bug, suspicious values, a source change coming). It goes to a person; include file:line references for code bugs.",
      inputSchema: {
        subject_type: z.enum(["series", "loader", "code", "source"]),
        subject_id: z.number().int().optional(),
        title: z.string().min(5).max(200),
        body: z.string().min(1).max(8000),
      },
    },
    wrap(
      async (a: {
        subject_type: string;
        subject_id?: number;
        title: string;
        body: string;
      }) => {
        const issue = await raiseFinding(actor, {
          universe: U,
          subjectType: a.subject_type,
          subjectId: a.subject_id ?? null,
          title: a.title,
          body: a.body,
        });
        return { id: issue.id, url: issueUrl(U, issue.id) };
      },
    ),
  );

  if (!ctx.isAgent) {
    server.registerTool(
      "assign_issue",
      {
        title: "Take or release an issue",
        description:
          "Assign an issue to yourself (the agent leaves it alone until you release it), or release it back.",
        inputSchema: { id: z.number().int(), take: z.boolean() },
      },
      wrap(async (a: { id: number; take: boolean }) => {
        await assignIssue(a.id, actor, a.take ? actor.userId : null);
        return { ok: true };
      }),
    );
  }

  if (ctx.isDev) {
    server.registerTool(
      "dismiss_issue",
      {
        title: "Dismiss an issue",
        description:
          "Dev only. Mark an issue as not a problem (e.g. a series intentionally without a source). It stays dismissed until its condition changes.",
        inputSchema: {
          id: z.number().int(),
          reason: z.string().min(3).max(500),
        },
      },
      wrap(async (a: { id: number; reason: string }) => {
        await dismissIssue(a.id, actor, a.reason);
        return { ok: true };
      }),
    );

    server.registerTool(
      "reopen_issue",
      {
        title: "Reopen an issue",
        description:
          "Dev only. Undo a dismissal or snooze, or reopen a resolved issue.",
        inputSchema: {
          id: z.number().int(),
          reason: z.string().max(500).optional(),
        },
      },
      wrap(async (a: { id: number; reason?: string }) => {
        await reopenIssue(a.id, actor, a.reason ?? null);
        return { ok: true };
      }),
    );
  }
}
