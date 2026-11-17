/**
 * Runner API (/api/ops-runner/<action>): the agent harness's bookkeeping.
 * Plain HTTP, not MCP: the harness calls it with the service token and the
 * model never sees it, so the model can't claim work or close a run.
 *
 *   POST start    { trigger, model, git_sha? }  → run id, budget, settings
 *   POST work     {}                             → items to investigate now
 *                                                  (also the liveness signal)
 *   POST budget   {}                             → today's and month's spend
 *   POST log      { run_id, steps[], usage? }    → record steps and usage
 *   POST finish   { run_id, status, … }          → close the run record
 *
 * Only the agent's service token is accepted; staff OAuth tokens are not.
 */

import { z } from "zod";

import {
  addRunUsage,
  claimWork,
  finishRun,
  getBudget,
  getWork,
  logSteps,
  recordPoll,
  startRun,
} from "@/core/ops/runs";
import { getOpsSettings } from "@/core/ops/settings";
import {
  ipAllowed,
  resolveAgent,
  UNIVERSE as U,
} from "@/lib/internal-mcp/shared";

export const runtime = "nodejs";

const startBody = z.object({
  trigger: z.string().max(16),
  model: z.string().max(64),
  git_sha: z.string().max(64).optional(),
});

const logBody = z.object({
  run_id: z.number().int(),
  steps: z
    .array(
      z.object({
        issue_id: z.number().int().nullable().optional(),
        seq: z.number().int(),
        kind: z.enum(["tool_call", "assistant", "error", "note", "usage"]),
        tool_name: z.string().nullable().optional(),
        input: z.string().nullable().optional(),
        output: z.string().nullable().optional(),
        is_error: z.boolean().optional(),
        duration_ms: z.number().nullable().optional(),
        cost_usd: z.number().nullable().optional(),
      }),
    )
    .max(200),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_write_tokens: z.number(),
      cache_read_tokens: z.number(),
      web_search_requests: z.number(),
      cost_usd: z.number(),
    })
    .optional(),
});

const finishBody = z.object({
  run_id: z.number().int(),
  status: z.enum(["finished", "failed", "budget_stopped"]),
  stop_reason: z.string().max(64).optional(),
  issues_investigated: z.number().int(),
  proposals_created: z.number().int(),
  summary: z.string().max(4000).optional(),
  error: z.string().max(4000).optional(),
});

const ACTIONS: Record<string, (body: unknown) => Promise<unknown>> = {
  async start(body) {
    const a = startBody.parse(body);
    const runId = await startRun({
      universe: U,
      trigger: a.trigger,
      model: a.model,
      gitSha: a.git_sha ?? null,
    });
    return {
      run_id: runId,
      budget: await getBudget(U),
      settings: await getOpsSettings(U),
    };
  },
  async work() {
    await recordPoll(U);
    const work = await getWork(U);
    await claimWork(work.items);
    return work;
  },
  budget: () => getBudget(U),
  async log(body) {
    const a = logBody.parse(body);
    await logSteps(
      a.run_id,
      a.steps.map((s) => ({
        issueId: s.issue_id ?? null,
        seq: s.seq,
        kind: s.kind,
        toolName: s.tool_name ?? null,
        input: s.input ?? null,
        output: s.output ?? null,
        isError: s.is_error,
        durationMs: s.duration_ms ?? null,
        costUsd: s.cost_usd ?? null,
      })),
    );
    if (a.usage) {
      await addRunUsage(a.run_id, {
        inputTokens: a.usage.input_tokens,
        outputTokens: a.usage.output_tokens,
        cacheWriteTokens: a.usage.cache_write_tokens,
        cacheReadTokens: a.usage.cache_read_tokens,
        webSearchRequests: a.usage.web_search_requests,
        costUsd: a.usage.cost_usd,
      });
    }
    return { ok: true };
  },
  async finish(body) {
    const a = finishBody.parse(body);
    await finishRun(a.run_id, {
      status: a.status,
      stopReason: a.stop_reason,
      issuesInvestigated: a.issues_investigated,
      proposalsCreated: a.proposals_created,
      summary: a.summary,
      error: a.error,
    });
    return { ok: true };
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
): Promise<Response> {
  if (!ipAllowed(req)) return json(403, { error: "Forbidden" });
  if (!(await resolveAgent(req)))
    return json(401, { error: "A valid agent service token is required" });
  const { action } = await params;
  const fn = ACTIONS[action];
  if (!fn) return json(404, { error: `Unknown runner action: ${action}` });
  try {
    const body = await req.json().catch(() => ({}));
    return json(200, await fn(body));
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(400, { error: "Bad request", issues: e.issues });
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
}
