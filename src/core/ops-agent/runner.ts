/**
 * Ops agent runner. A long-running service on the workstation: it asks the
 * Next server for work every few minutes (no model involved) and starts a
 * model conversation only when the server hands it an item. The model's
 * tools come from two MCP servers (catalog: the data; ops: issues and
 * review); the harness's own bookkeeping goes through the runner API,
 * which the model never sees. Code is read from a local checkout.
 * See ./README.md and docs/2026-11-13-ops-agent-design.md.
 *
 *   bun run ops-agent                 the service: poll, work, repeat
 *   bun run ops-agent --once          one pass, then exit
 *   bun run ops-agent --issue 123     investigate one issue, then exit
 *   bun run ops-agent --max-items 2   at most N items per pass
 *
 * Env: ANTHROPIC_API_KEY (the agent's own Console workspace, with a spend
 * limit), OPS_SERVER_URL (https://udaman…, no path), OPS_AGENT_TOKEN (uops_…),
 * OPS_REPO_ROOT (checkout, default cwd), OPS_GIT_SYNC_REF (e.g.
 * origin/master: fetch and check it out before each run, so the agent reads
 * the deployed code), OPS_POLL_SECONDS (default 300), OPS_AGENT_MODEL
 * (default claude-opus-5-5), OPS_AGENT_EFFORT (default medium).
 */

import { execFileSync } from "node:child_process";

import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessageParam,
  BetaTextBlock,
  BetaToolResultBlockParam,
  BetaToolUnion,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";

import { LocalTools } from "./local-tools";
import {
  connectAgentMcp,
  runnerApi,
  type McpConnection,
  type RunnerApi,
} from "./mcp-client";
import { costOf } from "./pricing";
import { buildKickoff, buildSystemPrompt, type WorkItemLike } from "./prompt";

const MODEL = process.env.OPS_AGENT_MODEL ?? "claude-opus-5-5";
const EFFORT = (process.env.OPS_AGENT_EFFORT ?? "medium") as
  "low" | "medium" | "high";
const MAX_TURNS_PER_ITEM = 30;
/** Hard ceiling per item, whatever the day's allowance. */
const MAX_ITEM_USD = 1.5;
/** Don't start an item with less than this left today. */
const MIN_START_USD = 0.15;

/** Tools that count as "the agent acted on the issue". */
const ISSUE_WRITE_TOOLS = new Set([
  "comment_on_issue",
  "propose_change",
  "resolve_issue",
  "raise_issue",
  "snooze_issue",
]);

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface Budget {
  remainingTodayUsd: number;
  monthSpentUsd: number;
  monthlyCapUsd: number;
}

interface StepBuf {
  issue_id: number | null;
  seq: number;
  kind: "tool_call" | "assistant" | "error" | "note" | "usage";
  tool_name?: string | null;
  input?: string | null;
  output?: string | null;
  is_error?: boolean;
  duration_ms?: number | null;
  cost_usd?: number | null;
}

/**
 * The tool list for one kind of work. Web search and fetch are attached
 * only where finding a source's documentation or release page needs them
 * (metadata and lag). Load-error conversations read the most internal data
 * and get `probe_source_url` (domain allowlist) alone, so nothing they read
 * can be sent to an arbitrary URL.
 */
function toolDefs(
  mcp: McpConnection,
  local: LocalTools,
  withWeb: boolean,
): BetaToolUnion[] {
  const mcpTools: BetaToolUnion[] = mcp.tools.map((t) => {
    // MCP schemas carry a JSON Schema `$schema` key the API doesn't need.
    const { $schema: _drop, ...schema } = t.inputSchema as Record<
      string,
      unknown
    >;
    void _drop;
    return {
      name: t.name,
      description: t.description ?? "",
      input_schema: { type: "object" as const, ...schema },
    };
  });
  const tools: BetaToolUnion[] = [
    ...mcpTools,
    ...(local.definitions() as BetaToolUnion[]),
    ...(withWeb
      ? ([
          { type: "web_search_20260209", name: "web_search", max_uses: 5 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
        ] as BetaToolUnion[])
      : []),
  ];
  // Cache breakpoint on the last tool: tools + system are the stable prefix.
  // (Copied, not mutated: the two tool lists share their definitions.)
  tools[tools.length - 1] = {
    ...tools[tools.length - 1],
    cache_control: { type: "ephemeral" },
  } as BetaToolUnion;
  return tools;
}

async function investigate(opts: {
  client: Anthropic;
  mcp: McpConnection;
  api: RunnerApi;
  local: LocalTools;
  system: string;
  tools: BetaToolUnion[];
  item: WorkItemLike;
  runId: number;
  autonomy: Record<string, number>;
  proposalsEnabled: boolean;
  itemBudgetUsd: number;
  seqStart: number;
}): Promise<{
  costUsd: number;
  proposals: number;
  seq: number;
  usage: Record<string, number>;
}> {
  const { client, mcp, api, local, item, runId } = opts;
  const issueId = item.issue.id;
  const steps: StepBuf[] = [];
  let seq = opts.seqStart;
  let cost = 0;
  let proposals = 0;
  let actedOnIssue = false;
  let finalText = "";
  const usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_write_tokens: 0,
    cache_read_tokens: 0,
    web_search_requests: 0,
    cost_usd: 0,
  };

  const messages: BetaMessageParam[] = [
    {
      role: "user",
      content: buildKickoff(item, {
        autonomy: opts.autonomy,
        itemBudgetUsd: opts.itemBudgetUsd,
        proposalsEnabled: opts.proposalsEnabled,
      }),
    },
  ];
  let wrapUpSent = false;

  for (let turn = 0; turn < MAX_TURNS_PER_ITEM; turn++) {
    const t0 = Date.now();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: opts.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: opts.tools,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    const u = response.usage;
    const c = costOf(response.model ?? MODEL, u);
    cost += c;
    usage.input_tokens += u.input_tokens ?? 0;
    usage.output_tokens += u.output_tokens ?? 0;
    usage.cache_write_tokens += u.cache_creation_input_tokens ?? 0;
    usage.cache_read_tokens += u.cache_read_input_tokens ?? 0;
    usage.web_search_requests += u.server_tool_use?.web_search_requests ?? 0;
    usage.cost_usd += c;

    const text = response.content
      .filter((b): b is BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (text) finalText = text;
    steps.push({
      issue_id: issueId,
      seq: seq++,
      kind: "assistant",
      output: text || `(stop_reason ${response.stop_reason})`,
      duration_ms: Date.now() - t0,
      cost_usd: c,
    });

    if (response.stop_reason === "refusal") {
      steps.push({
        issue_id: issueId,
        seq: seq++,
        kind: "error",
        output: "Model declined (refusal)",
        is_error: true,
      });
      break;
    }
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const toolUses = response.content.filter(
      (b): b is BetaToolUseBlock => b.type === "tool_use",
    );
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

    messages.push({ role: "assistant", content: response.content });
    const results: BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const input = (tu.input ?? {}) as Record<string, unknown>;
      const t1 = Date.now();
      let out: string;
      let isError = false;
      try {
        if (local.has(tu.name)) {
          out = local.run(tu.name, input);
        } else {
          const r = await mcp.callRaw(tu.name, input);
          out = r.text;
          isError = r.isError;
          if (!isError && ISSUE_WRITE_TOOLS.has(tu.name)) actedOnIssue = true;
          if (!isError && tu.name === "propose_change") proposals++;
        }
      } catch (e) {
        out = e instanceof Error ? e.message : String(e);
        isError = true;
      }
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: out.slice(0, 60_000),
        is_error: isError || undefined,
      });
      steps.push({
        issue_id: issueId,
        seq: seq++,
        kind: "tool_call",
        tool_name: tu.name,
        input: JSON.stringify(input),
        output: out,
        is_error: isError,
        duration_ms: Date.now() - t1,
      });
    }
    const content: BetaContentBlockParam[] = [...results];
    if (!wrapUpSent && cost >= opts.itemBudgetUsd * 0.85) {
      content.push({
        type: "text",
        text: "Spend limit for this item is nearly used. Record your diagnosis on the issue now (comment_on_issue kind=diagnosis, or a proposal/question if you have one ready) and stop.",
      });
      wrapUpSent = true;
    } else if (wrapUpSent && cost >= opts.itemBudgetUsd * 1.15) {
      messages.push({ role: "user", content: results });
      steps.push({
        issue_id: issueId,
        seq: seq++,
        kind: "note",
        output: "Stopped: item spend limit reached",
      });
      break;
    }
    messages.push({ role: "user", content });
  }

  // Every item leaves a trace on its issue, so it isn't picked again with
  // nothing new, and people can see what was looked at.
  if (!actedOnIssue) {
    const body = finalText.trim()
      ? `Agent notes (no action taken):\n${finalText.trim().slice(0, 6000)}`
      : "The agent looked at this but reached no conclusion within its limits.";
    try {
      await mcp.call("comment_on_issue", {
        id: issueId,
        body,
        kind: "comment",
      });
    } catch (e) {
      steps.push({
        issue_id: issueId,
        seq: seq++,
        kind: "error",
        output: String(e),
        is_error: true,
      });
    }
  }

  await api
    .call("log", { run_id: runId, steps, usage })
    .catch((e) => console.error("runner log failed", e));
  return { costUsd: cost, proposals, seq, usage };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let stopping = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log(`${sig}: finishing the current item, then stopping`);
  });
}

/** Put the checkout on the deployed code before a run reads it. */
function syncCheckout(root: string): void {
  const ref = process.env.OPS_GIT_SYNC_REF;
  if (!ref) return;
  if (!/^[\w./-]+$/.test(ref)) throw new Error("OPS_GIT_SYNC_REF is not a ref");
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, stdio: "pipe", timeout: 120_000 });
  try {
    git("fetch", "--quiet", "origin");
    git("checkout", "--quiet", "--detach", ref);
  } catch (e) {
    // Reading slightly old code beats not running.
    console.error("git sync failed; using the checkout as it is", e);
  }
}

/**
 * One pass: ask for work, and if there is any, run it as one recorded run.
 * Returns whether anything was investigated.
 */
async function pass(opts: {
  serverUrl: string;
  token: string;
  root: string;
  onlyIssue: number | null;
  maxItems: number;
  trigger?: string;
}): Promise<{ worked: boolean; failed: boolean; idle: string | null }> {
  const api = runnerApi(opts.serverUrl, opts.token);
  // The MCP servers are only connected when there is work: an idle poll is
  // one small HTTP request.
  let mcp: McpConnection | null = null;
  let runId: number | null = null;
  let investigated = 0;
  let proposals = 0;
  let seq = 0;
  let status: "finished" | "failed" | "budget_stopped" = "finished";
  let stopReason: string | undefined;
  let error: string | undefined;

  try {
    let items: WorkItemLike[];
    let idle: string | null = null;
    if (opts.onlyIssue) {
      mcp = await connectAgentMcp(opts.serverUrl, opts.token);
      const got = await mcp.call<{
        issue: WorkItemLike["issue"];
        events: WorkItemLike["events"];
      }>("get_issue", { id: opts.onlyIssue });
      items = [
        {
          workClass:
            got.issue.kind === "missing_metadata"
              ? "metadata"
              : got.issue.kind === "loader_lag"
                ? "lag"
                : "errors",
          reason: "new",
          groupKey: null,
          issue: got.issue,
          events: got.events,
          memberIssueIds: [opts.onlyIssue],
          memberCount: 1,
        },
      ];
    } else {
      const work = await api.call<{
        paused: boolean;
        idleReason: string | null;
        items: WorkItemLike[];
      }>("work");
      items = work.items.slice(0, opts.maxItems);
      idle = work.idleReason;
    }
    if (!items.length) return { worked: false, failed: false, idle };

    mcp ??= await connectAgentMcp(opts.serverUrl, opts.token);
    syncCheckout(opts.root);
    const local = new LocalTools(opts.root);
    const client = new Anthropic();
    const system = buildSystemPrompt();
    const tools = {
      plain: toolDefs(mcp, local, false),
      web: toolDefs(mcp, local, true),
    };

    const start = await api.call<{
      run_id: number;
      budget: Budget;
      settings: { autonomy: Record<string, number>; proposalsEnabled: boolean };
    }>("start", {
      trigger:
        opts.trigger ??
        (opts.onlyIssue
          ? "manual"
          : items.some((i) => i.reason !== "new")
            ? "human_input"
            : "work_available"),
      model: MODEL,
      git_sha: local.headSha() ?? undefined,
    });
    runId = start.run_id;
    console.log(
      `run ${runId}: ${items.length} item(s); $${start.budget.remainingTodayUsd.toFixed(2)} left today, $${start.budget.monthSpentUsd.toFixed(2)}/$${start.budget.monthlyCapUsd} this month`,
    );

    for (const item of items) {
      if (stopping) {
        stopReason = "stopped by signal";
        break;
      }
      const budget = await api.call<Budget>("budget");
      if (budget.remainingTodayUsd < MIN_START_USD) {
        status = "budget_stopped";
        stopReason = "budget for today used";
        break;
      }
      const itemBudgetUsd = Math.min(MAX_ITEM_USD, budget.remainingTodayUsd);
      console.log(
        `issue #${item.issue.id} (${item.workClass}, ${item.reason}, group of ${item.memberCount}) budget $${itemBudgetUsd.toFixed(2)}`,
      );
      try {
        const r = await investigate({
          client,
          mcp,
          api,
          local,
          system,
          tools: item.workClass === "errors" ? tools.plain : tools.web,
          item,
          runId,
          autonomy: start.settings.autonomy,
          proposalsEnabled: start.settings.proposalsEnabled,
          itemBudgetUsd,
          seqStart: seq,
        });
        seq = r.seq;
        investigated++;
        proposals += r.proposals;
        console.log(
          `  → $${r.costUsd.toFixed(3)}, ${r.proposals} proposal(s); cache read ${r.usage.cache_read_tokens}`,
        );
      } catch (e) {
        // One item failing (API error, bad tool) shouldn't end the run.
        console.error(`  item failed:`, e);
        await api
          .call("log", {
            run_id: runId,
            steps: [
              {
                issue_id: item.issue.id,
                seq: seq++,
                kind: "error",
                output: String(e),
                is_error: true,
              },
            ],
          })
          .catch(() => {});
        if (
          e instanceof Anthropic.AuthenticationError ||
          e instanceof Anthropic.PermissionDeniedError
        )
          throw e;
      }
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error(e);
  } finally {
    if (runId != null) {
      await api
        .call("finish", {
          run_id: runId,
          status,
          stop_reason: stopReason,
          issues_investigated: investigated,
          proposals_created: proposals,
          error,
        })
        .catch((e) => console.error("runner finish failed", e));
    }
    await mcp?.close();
  }
  return {
    worked: investigated > 0,
    failed: status === "failed",
    idle: stopReason ?? null,
  };
}

async function main() {
  const serverUrl = process.env.OPS_SERVER_URL;
  const token = process.env.OPS_AGENT_TOKEN;
  if (!serverUrl || !token)
    throw new Error("OPS_SERVER_URL and OPS_AGENT_TOKEN are required");
  const onlyIssue = arg("--issue") ? Number(arg("--issue")) : null;
  const once = process.argv.includes("--once") || onlyIssue != null;
  const opts = {
    serverUrl,
    token,
    root: process.env.OPS_REPO_ROOT ?? process.cwd(),
    onlyIssue,
    maxItems: Number(arg("--max-items") ?? 20),
    trigger: arg("--trigger"),
  };
  const pollMs =
    Math.max(30, Number(process.env.OPS_POLL_SECONDS) || 300) * 1000;

  if (once) {
    const r = await pass(opts);
    if (!r.worked) console.log(`nothing to do${r.idle ? `: ${r.idle}` : ""}`);
    if (r.failed) process.exitCode = 1;
    return;
  }

  console.log(`ops agent: polling ${serverUrl} every ${pollMs / 1000}s`);
  let lastIdle = "";
  let failures = 0;
  while (!stopping) {
    let wait = pollMs;
    try {
      const r = await pass(opts);
      if (r.failed) failures++;
      else failures = 0;
      // After real work, look again soon: a review may have freed a place.
      if (r.worked && !r.failed) wait = 15_000;
      if (!r.worked && r.idle && r.idle !== lastIdle) {
        console.log(`idle: ${r.idle}`);
        lastIdle = r.idle;
      } else if (r.worked) lastIdle = "";
    } catch (e) {
      failures++;
      console.error("poll failed", e instanceof Error ? e.message : e);
    }
    // Back off when the server or the API keeps failing (max 1 hour).
    if (failures > 1) wait = Math.min(pollMs * 2 ** (failures - 1), 3_600_000);
    for (let waited = 0; waited < wait && !stopping; waited += 1000)
      await sleep(1000);
  }
}

await main();
