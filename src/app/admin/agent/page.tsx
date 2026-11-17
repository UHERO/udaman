import Link from "next/link";
import { notFound } from "next/navigation";
import { formatHst, hstToday, hstToInstant } from "@catalog/utils/time";

import { getAgentDashboard } from "@/actions/ops";
import {
  AutonomySelect,
  PauseToggle,
  SettingInput,
  TokenControls,
} from "@/components/admin/agent-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WidthToggleBar } from "@/components/width-toggle-bar";
import { CHANGE_TYPES } from "@/core/ops/types";
import { requireAuth } from "@/lib/auth/dal";

const usd = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;

export default async function AgentPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") notFound();

  let d: Awaited<ReturnType<typeof getAgentDashboard>>;
  try {
    d = await getAgentDashboard();
  } catch (e) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Ops agent</h1>
        <p className="text-sm">
          Couldn&apos;t load agent data. Has the{" "}
          <code>20261113000000_ops_agent</code> migration been applied?
        </p>
        <pre className="text-muted-foreground text-xs">
          {e instanceof Error ? e.message : String(e)}
        </pre>
      </div>
    );
  }
  const {
    settings,
    lastPollAt,
    budget,
    runs,
    tokens,
    stats,
    typeStats,
    outcomes,
    reopen,
    counts,
  } = d;
  const streaks = new Map(typeStats.map((t) => [t.changeType, t]));
  // The runner asks for work every few minutes, with or without any.
  const hoursSince = lastPollAt
    ? (Date.now() -
        hstToInstant(new Date(`${lastPollAt.replace(" ", "T")}Z`)).getTime()) /
      3600000
    : null;
  const lastFinished = runs.find((r) => r.finished_at);
  const failed = runs.filter((r) => r.status === "failed").length;
  const stopped = runs.filter((r) => r.status === "budget_stopped").length;
  const resolvedByAgent = outcomes
    .filter((o) => o.path === "agent" || o.path === "agent_proposal")
    .reduce((n, o) => n + Number(o.n), 0);
  const costPerResolved = resolvedByAgent
    ? budget.monthSpentUsd / resolvedByAgent
    : null;
  // Pace: spend per elapsed day (HST), projected over the whole month.
  const dayOfMonth = Number(hstToday().slice(8, 10));
  const forecast =
    (budget.monthSpentUsd / Math.max(1, dayOfMonth)) *
    (dayOfMonth + budget.daysLeftInMonth - 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ops agent</h1>
          <p className="text-muted-foreground text-sm">
            Runs, spend, review quality and controls. Billing truth is the
            Anthropic Console; this page is what the agent did. Design:
            docs/2026-11-13-ops-agent-design.md
          </p>
        </div>
        <PauseToggle paused={settings.agentPaused} />
      </div>
      <WidthToggleBar />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              Runner last asked for work:{" "}
              <strong
                className={
                  hoursSince != null && hoursSince > 1 ? "text-red-600" : ""
                }
              >
                {hoursSince == null
                  ? "never"
                  : hoursSince < 1
                    ? `${Math.round(hoursSince * 60)} min ago`
                    : `${hoursSince.toFixed(1)}h ago`}
              </strong>
            </div>
            <div>
              Last run with work:{" "}
              {lastFinished
                ? formatHst(String(lastFinished.finished_at))
                : "never"}
            </div>
            <div>Failed runs (last 60): {failed}</div>
            <div>Stopped by budget/limits: {stopped}</div>
            <div>
              {settings.agentPaused ? "⏸ Paused" : "▶ Active"} ·{" "}
              {settings.proposalsEnabled ? "proposing" : "comment-only"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              This month: <strong>{usd(budget.monthSpentUsd)}</strong> of{" "}
              {usd(budget.monthlyCapUsd)}
            </div>
            <div>Forecast at this month&apos;s pace: {usd(forecast)}</div>
            <div>
              Today: {usd(budget.todaySpentUsd)} of{" "}
              {usd(budget.dailyAllowanceUsd)}
            </div>
            <div>
              Cost per issue resolved by the agent:{" "}
              {costPerResolved == null ? "–" : usd(costPerResolved)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outcomes (90 days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {outcomes.length === 0 && (
              <div className="text-muted-foreground">No resolutions yet.</div>
            )}
            {outcomes.map((o) => (
              <div key={o.path ?? "?"}>
                {o.path ?? "?"}: {Number(o.n)} · avg{" "}
                {o.avg_hours == null
                  ? "–"
                  : `${Number(o.avg_hours).toFixed(1)}h`}
              </div>
            ))}
            <div className="text-muted-foreground">
              Reopened after resolving: {reopen.reopened}/{reopen.total}
            </div>
            <div className="text-muted-foreground">
              Live:{" "}
              {Object.entries(counts.byKind)
                .map(([k, n]) => `${k} ${n}`)
                .join(" · ") || "none"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Review quality and autonomy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proposal kind</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Rejected</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Stale</TableHead>
                <TableHead>Withdrawn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s) => (
                <TableRow key={s.kind}>
                  <TableCell>{s.kind}</TableCell>
                  <TableCell>{s.approved}</TableCell>
                  <TableCell>{s.rejected}</TableCell>
                  <TableCell>{s.applied}</TableCell>
                  <TableCell>{s.failed}</TableCell>
                  <TableCell>{s.stale}</TableCell>
                  <TableCell>{s.withdrawn}</TableCell>
                </TableRow>
              ))}
              {stats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No proposals yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="grid gap-2 md:grid-cols-2">
            {CHANGE_TYPES.map((t) => (
              <label
                key={t}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  {t}
                  <span className="text-muted-foreground ml-2 text-xs">
                    {streaks.get(t)
                      ? `${streaks.get(t)!.streak} in a row approved · ${streaks.get(t)!.approved} approved, ${streaks.get(t)!.rejected} rejected, ${streaks.get(t)!.failed} failed`
                      : "no reviews yet"}
                  </span>
                </span>
                <AutonomySelect changeType={t} level={settings.autonomy[t]} />
              </label>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Level 0: the agent proposes, a reviewer approves. Raise a type only
            when its record supports it: the count is consecutive agent
            proposals of that type approved and applied cleanly, reset by a
            rejection or a failed apply. Lower it again by hand if a fix
            doesn&apos;t hold. Metadata writes only ever fill empty fields
            directly; overwriting is always a proposal.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Queue and budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <SettingInput
              name="agent.proposals_enabled"
              label="Proposals on (1) or comment-only (0)"
              value={settings.proposalsEnabled ? "1" : "0"}
            />
            <SettingInput
              name="queue.active_slots"
              label="Proposals shown for review at once"
              value={String(settings.activeSlots)}
            />
            <SettingInput
              name="queue.ready_target"
              label="Ready buffer (shown + waiting)"
              value={String(settings.readyTarget)}
            />
            <SettingInput
              name="agent.max_items_per_day"
              label="New items per day, at most"
              value={String(settings.maxItemsPerDay)}
            />
            <SettingInput
              name="metadata.required_fields"
              label="Required metadata fields"
              value={settings.requiredMetadataFields.join(",")}
              wide
            />
            <SettingInput
              name="reviewers.user_ids"
              label="Extra reviewers (user ids)"
              value={settings.reviewerUserIds.join(",")}
              wide
            />
            <SettingInput
              name="budget.monthly_usd"
              label="Monthly cap (USD)"
              value={String(settings.monthlyBudgetUsd)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <TokenControls
              tokens={tokens.map((t) => ({
                ...t,
                created_at: String(t.created_at),
                last_used_at: t.last_used_at ? String(t.last_used_at) : null,
                revoked_at: t.revoked_at ? String(t.revoked_at) : null,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Investigated</TableHead>
                <TableHead>Proposals</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Tokens in/out (cache read)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <Link
                      href={`/admin/agent/runs/${r.id}`}
                      className="hover:underline"
                    >
                      {String(r.id)}
                    </Link>
                  </TableCell>
                  <TableCell>{formatHst(String(r.started_at))}</TableCell>
                  <TableCell title={String(r.error ?? r.stop_reason ?? "")}>
                    {String(r.status)}
                  </TableCell>
                  <TableCell>{String(r.trigger)}</TableCell>
                  <TableCell>{String(r.issues_investigated)}</TableCell>
                  <TableCell>{String(r.proposals_created)}</TableCell>
                  <TableCell>{usd(r.cost_usd)}</TableCell>
                  <TableCell className="text-xs">
                    {String(r.input_tokens)}/{String(r.output_tokens)} (
                    {String(r.cache_read_tokens)})
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    No runs yet. See src/core/ops-agent/README.md to set up the
                    workstation.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
