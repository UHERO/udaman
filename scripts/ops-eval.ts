/**
 * Replay evaluation for the ops agent (docs/2026-11-13-ops-agent-design.md,
 * rollout step C): does the agent propose the fix a person actually made?
 *
 * Cases come from the loader action history: consecutive edits to a
 * loader's load statement. A pair is a usable case only if, today, the old
 * statement still fails in a dry run and the person's statement passes;
 * that failure is the "error" the agent is shown. (Old errors themselves
 * weren't recorded, and many old statements now fail differently or not at
 * all, so expect a fraction of the history to qualify.)
 *
 * LOCAL DATABASE ONLY. `prepare` rewrites a loader's eval and error.
 *
 *   bun run scripts/ops-eval.ts build --out cases.json [--since 2025-11-01] [--limit 200]
 *   bun run scripts/ops-eval.ts prepare 0 --cases cases.json
 *        → puts loader back to the broken statement, creates the issue,
 *          prints the agent command (needs the local Next server running,
 *          OPS_MCP_URL=http://localhost:3000/api/mcp/ops and a local token)
 *   bun run ops-agent --issue <id>
 *   bun run scripts/ops-eval.ts finish --cases cases.json
 *        → scores the agent's proposal against the person's fix, restores
 *          the loader, and appends the result to cases.json.results.jsonl
 */
import {
  appendFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import { mysql } from "@database/mysql";

import { dryRunLoad } from "@/core/ops/dry-run";
import { ProposalStore } from "@/core/ops/proposal-store";
import { reconcile } from "@/core/ops/reconciler";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const UNIVERSE = "UHERO";

interface EvalCase {
  loaderId: number;
  seriesName: string | null;
  fixedAt: string;
  fixedBy: string | null;
  brokenEval: string;
  humanEval: string;
  error: string;
}

function assertLocal(): void {
  const url = process.env.DB_MYSQL_URL ?? "";
  const host = process.env.DB_HOST ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url) || (host && host !== "localhost"))
    throw new Error("ops-eval only runs against a local database");
}

const norm = (e: string) => e.replace(/\s+/g, " ").trim();

async function build(): Promise<void> {
  const out = opt("--out") ?? "cases.json";
  const since = opt("--since") ?? "2025-11-01";
  const limit = Number(opt("--limit") ?? 200);
  const rows = await mysql<{
    data_source_id: number;
    eval: string | null;
    user_email: string | null;
    created_at: Date | string;
  }>`
    SELECT a.data_source_id, a.eval, a.user_email, a.created_at
    FROM data_source_actions a
    JOIN data_sources ds ON ds.id = a.data_source_id
    WHERE ds.universe = ${UNIVERSE} AND ds.disabled = 0
      AND a.action IN ('CREATE', 'UPDATE') AND a.eval IS NOT NULL
    ORDER BY a.data_source_id, a.created_at, a.id
  `;
  // Consecutive statements per loader that differ, newest pairs first.
  const pairs: Array<Omit<EvalCase, "error" | "seriesName">> = [];
  let prev: (typeof rows)[number] | null = null;
  for (const r of rows) {
    if (
      prev &&
      prev.data_source_id === r.data_source_id &&
      norm(prev.eval!) !== norm(r.eval!) &&
      // data_source_actions.eval is VARCHAR(500): longer ones are cut.
      prev.eval!.length < 500 &&
      r.eval!.length < 500 &&
      new Date(r.created_at).toISOString().slice(0, 10) >= since
    ) {
      pairs.push({
        loaderId: Number(r.data_source_id),
        fixedAt: new Date(r.created_at).toISOString().slice(0, 10),
        fixedBy: r.user_email,
        brokenEval: prev.eval!,
        humanEval: r.eval!,
      });
    }
    prev = r;
  }
  pairs.sort((a, b) => b.fixedAt.localeCompare(a.fixedAt));
  console.log(
    `${pairs.length} statement edits since ${since}; dry-running up to ${limit}`,
  );

  const cases: EvalCase[] = [];
  for (const p of pairs.slice(0, limit)) {
    const current = await mysql<{ eval: string | null; name: string | null }>`
      SELECT ds.eval, s.name FROM data_sources ds
      LEFT JOIN series s ON s.id = ds.series_id WHERE ds.id = ${p.loaderId}
    `;
    // Only edits still in place: the person's statement is the answer key.
    if (!current[0] || norm(current[0].eval ?? "") !== norm(p.humanEval))
      continue;
    const broken = await dryRunLoad({
      loaderId: p.loaderId,
      eval: p.brokenEval,
    });
    if (broken.ok) continue; // old statement works today: not a repair case
    const human = await dryRunLoad({ loaderId: p.loaderId, eval: p.humanEval });
    if (!human.ok) continue; // can't be scored (or the network is down)
    cases.push({
      ...p,
      seriesName: current[0].name,
      error: broken.error ?? "unknown error",
    });
    console.log(
      `case ${cases.length - 1}: loader ${p.loaderId} ${current[0].name}: ${broken.error}`,
    );
  }
  writeFileSync(out, JSON.stringify(cases, null, 1));
  console.log(`Wrote ${cases.length} cases to ${out}`);
}

const statePath = (cases: string) => `${cases}.state.json`;

async function prepare(): Promise<void> {
  const casesPath = opt("--cases") ?? "cases.json";
  const index = Number(args[1]);
  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as EvalCase[];
  const c = cases[index];
  if (!c) throw new Error(`No case ${args[1]} in ${casesPath}`);
  if (existsSync(statePath(casesPath)))
    throw new Error("A case is already prepared; run `finish` first");
  const before = await mysql<{
    eval: string | null;
    last_error: string | null;
    last_error_at: Date | string | null;
  }>`SELECT eval, last_error, last_error_at FROM data_sources WHERE id = ${c.loaderId}`;
  writeFileSync(
    statePath(casesPath),
    JSON.stringify({ index, loaderId: c.loaderId, before: before[0] }),
  );
  // updated_at is left alone on purpose (the public sweep reads it).
  await mysql`
    UPDATE data_sources SET eval = ${c.brokenEval},
      last_error = ${c.error.slice(0, 254)}, last_error_at = NOW()
    WHERE id = ${c.loaderId}
  `;
  await reconcile(UNIVERSE);
  const issue = await mysql<{ id: number }>`
    SELECT id FROM ops_issues
    WHERE kind = 'load_error' AND subject_type = 'loader'
      AND subject_id = ${c.loaderId} AND status = 'open'
    ORDER BY id DESC LIMIT 1
  `;
  if (!issue[0]) throw new Error("The reconciler didn't create an issue");
  console.log(
    `Case ${index} prepared: loader ${c.loaderId} (${c.seriesName}) is broken again.\nRun:  bun run ops-agent --issue ${issue[0].id}\nThen: bun run scripts/ops-eval.ts finish --cases ${casesPath}`,
  );
}

async function finish(): Promise<void> {
  const casesPath = opt("--cases") ?? "cases.json";
  const state = JSON.parse(readFileSync(statePath(casesPath), "utf8")) as {
    index: number;
    loaderId: number;
    before: { eval: string | null; last_error: string | null };
  };
  const c = (JSON.parse(readFileSync(casesPath, "utf8")) as EvalCase[])[
    state.index
  ];
  const proposals = (
    await ProposalStore.list({ universe: UNIVERSE, limit: 500 })
  ).filter((p) =>
    p.targets.some(
      (t) => t.targetType === "loader" && t.targetId === state.loaderId,
    ),
  );
  const p = proposals.sort((a, b) => b.id - a.id)[0];
  const proposed = p?.targets.find((t) => t.targetId === state.loaderId)?.after
    .eval as string | undefined;

  let outcome: string;
  let detail: Record<string, unknown> = {};
  if (!p) outcome = "no_proposal";
  else if (!proposed) outcome = `proposed_${p.kind}`;
  else if (norm(proposed) === norm(c.humanEval)) outcome = "same_statement";
  else {
    // Different text can still load the same data: compare the two results.
    const [a, h] = await Promise.all([
      dryRunLoad({ loaderId: state.loaderId, eval: proposed }),
      dryRunLoad({ loaderId: state.loaderId, eval: c.humanEval }),
    ]);
    const same =
      a.ok &&
      h.ok &&
      a.newPointCount === h.newPointCount &&
      a.firstDate === h.firstDate &&
      a.lastDate === h.lastDate &&
      a.changed === h.changed;
    outcome = same ? "same_data" : "different";
    detail = {
      agent: {
        ok: a.ok,
        points: a.newPointCount,
        last: a.lastDate,
        changed: a.changed,
        error: a.error,
      },
      human: {
        ok: h.ok,
        points: h.newPointCount,
        last: h.lastDate,
        changed: h.changed,
      },
    };
  }

  // Restore the loader, and drop what the case created.
  await mysql`
    UPDATE data_sources SET eval = ${state.before.eval},
      last_error = ${state.before.last_error},
      last_error_at = IF(${state.before.last_error} IS NULL, NULL, last_error_at)
    WHERE id = ${state.loaderId}
  `;
  for (const x of proposals)
    await mysql`DELETE FROM ops_proposals WHERE id = ${x.id}`;
  await reconcile(UNIVERSE);
  rmSync(statePath(casesPath));

  const result = {
    case: state.index,
    loaderId: state.loaderId,
    series: c.seriesName,
    outcome,
    proposalId: p?.id ?? null,
    proposedEval: proposed ?? null,
    humanEval: c.humanEval,
    ...detail,
  };
  appendFileSync(`${casesPath}.results.jsonl`, `${JSON.stringify(result)}\n`);
  console.log(JSON.stringify(result, null, 1));
}

async function run(): Promise<void> {
  assertLocal();
  process.env.SLACK_DISABLED = "1";
  const cmd = args[0];
  if (cmd === "build") await build();
  else if (cmd === "prepare") await prepare();
  else if (cmd === "finish") await finish();
  else {
    console.log(
      "Usage: bun run scripts/ops-eval.ts build|prepare <n>|finish [--cases cases.json]",
    );
    process.exitCode = cmd ? 1 : 0;
  }
}

await run();
process.exit(process.exitCode ?? 0);
