"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { reviewProposalAction } from "@/actions/ops";
import { StatusBadge } from "@/components/ops/ops-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ProposalRow } from "@/core/ops/types";

type DryRun = {
  basis?: string | null;
  runs?: Array<{
    targetId: number;
    result: {
      ok: boolean;
      error?: string;
      newPointCount?: number;
      currentPointCount?: number;
      added?: number;
      removed?: number;
      changed?: number;
      maxRelativeChange?: number | null;
      lastDate?: string | null;
    };
  }>;
};

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "∅";
  return typeof v === "string" ? v : JSON.stringify(v);
}

export function ProposalCard({
  proposal: p,
  universe,
  canReview,
}: {
  proposal: ProposalRow;
  universe: string;
  canReview: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const dry = (p.dryRun ?? {}) as DryRun;
  const reviewable = p.status === "pending" || p.status === "queued";

  const review = (decision: "approve" | "reject") =>
    start(async () => {
      const r = await reviewProposalAction(p.id, decision, note);
      if (r.ok) {
        toast.success(r.message ?? "Done");
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <StatusBadge status={p.status} />#{p.id} {p.summary}
        </CardTitle>
        <div className="text-muted-foreground text-xs">
          {p.kind} · {p.targets.length} target
          {p.targets.length === 1 ? "" : "s"}
          {dry.basis ? ` · basis: ${dry.basis}` : ""}
          {p.issueId ? (
            <>
              {" · "}
              <Link
                className="hover:underline"
                href={`/udaman/${universe}/investigations/issues/${p.issueId}`}
              >
                issue #{p.issueId}
              </Link>
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {p.evidence && (
          <details open={p.status === "pending"}>
            <summary className="cursor-pointer font-medium">Evidence</summary>
            <div className="mt-1 whitespace-pre-wrap">{p.evidence}</div>
          </details>
        )}
        <details open={p.targets.length <= 5}>
          <summary className="cursor-pointer font-medium">Changes</summary>
          <table className="mt-1 w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="py-1">Target</th>
                <th>Field</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {p.targets.slice(0, 50).flatMap((t) =>
                Object.keys({ ...t.after }).length
                  ? Object.keys(t.after).map((k) => (
                      <tr
                        key={`${t.targetId}-${k}`}
                        className="border-t align-top"
                      >
                        <td className="py-1 pr-2">
                          {t.targetType} {t.targetId}
                        </td>
                        <td className="pr-2">{k}</td>
                        <td className="pr-2 font-mono break-all">
                          {fmt(t.before[k])}
                        </td>
                        <td className="font-mono break-all">
                          {fmt(t.after[k])}
                        </td>
                      </tr>
                    ))
                  : [
                      <tr key={`${t.targetId}`} className="border-t">
                        <td className="py-1 pr-2" colSpan={4}>
                          {t.targetType} {t.targetId}
                        </td>
                      </tr>,
                    ],
              )}
            </tbody>
          </table>
          {p.targets.length > 50 && (
            <p className="text-muted-foreground mt-1">
              …and {p.targets.length - 50} more
            </p>
          )}
        </details>
        {dry.runs && dry.runs.length > 0 && (
          <details>
            <summary className="cursor-pointer font-medium">Dry run</summary>
            <ul className="mt-1 space-y-1 text-xs">
              {dry.runs.map((r) => (
                <li key={r.targetId}>
                  target {r.targetId}:{" "}
                  {r.result.ok
                    ? `${r.result.newPointCount} points (was ${r.result.currentPointCount}); +${r.result.added} −${r.result.removed} ~${r.result.changed}${r.result.maxRelativeChange != null ? ` (max change ${(r.result.maxRelativeChange * 100).toFixed(1)}%)` : ""}; newest ${r.result.lastDate}`
                    : `failed: ${r.result.error}`}
                </li>
              ))}
            </ul>
          </details>
        )}
        {p.reviewNote && (
          <p className="text-muted-foreground">Note: {p.reviewNote}</p>
        )}
        {canReview && reviewable && (
          <div className="space-y-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note for the agent (optional; say why if rejecting)"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => review("approve")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => review("reject")}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
