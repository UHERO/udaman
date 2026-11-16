import Link from "next/link";
import { formatHst } from "@catalog/utils/time";

import { listOpsIssues } from "@/actions/ops";
import {
  kindLabel,
  SeverityDot,
  StatusBadge,
} from "@/components/ops/ops-badges";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { IssueKind, IssueStatus } from "@/core/ops/types";

const STATUS_FILTERS: Array<{ label: string; value: IssueStatus[] }> = [
  {
    label: "Live",
    value: ["open", "investigating", "awaiting_human", "resolving"],
  },
  { label: "Waiting on a person", value: ["awaiting_human"] },
  { label: "Resolved", value: ["resolved"] },
  { label: "Dismissed", value: ["dismissed"] },
  { label: "Closed", value: ["closed"] },
];
const KIND_FILTERS: IssueKind[] = [
  "load_error",
  "reload_job_failed",
  "loader_lag",
  "missing_metadata",
  "agent_finding",
];

export default async function IssuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string }>;
  searchParams: Promise<{
    status?: string;
    kind?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const { universe } = await params;
  const sp = await searchParams;
  const statusIdx = Math.max(
    0,
    STATUS_FILTERS.findIndex((f) => f.label === sp.status),
  );
  const status = STATUS_FILTERS[statusIdx];
  const kind = KIND_FILTERS.includes(sp.kind as IssueKind)
    ? (sp.kind as IssueKind)
    : undefined;
  const page = Number(sp.page) || 1;

  const data = await listOpsIssues({
    universe,
    status: status.value,
    kind: kind ? [kind] : undefined,
    search: sp.q,
    page,
  });

  const base = `/udaman/${universe}/investigations/issues`;
  const href = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { status: status.label, kind, q: sp.q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `${base}?${q.toString()}`;
  };
  const pages = Math.max(1, Math.ceil(data.total / data.perPage));

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Issues</h1>
        <p className="text-muted-foreground text-sm">
          Load errors, failed reloads and missing metadata, tracked until their
          condition clears, whoever fixes them. Live by kind:{" "}
          {Object.entries(data.counts.byKind)
            .map(([k, n]) => `${kindLabel(k)} ${n}`)
            .join(" · ") || "none"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.label}
            asChild
            size="sm"
            variant={f.label === status.label ? "default" : "outline"}
          >
            <Link href={href({ status: f.label, page: undefined })}>
              {f.label}
            </Link>
          </Button>
        ))}
        <span className="text-muted-foreground mx-2">|</span>
        <Button asChild size="sm" variant={!kind ? "default" : "outline"}>
          <Link href={href({ kind: undefined, page: undefined })}>
            All kinds
          </Link>
        </Button>
        {KIND_FILTERS.map((k) => (
          <Button
            key={k}
            asChild
            size="sm"
            variant={k === kind ? "default" : "outline"}
          >
            <Link href={href({ kind: k, page: undefined })}>
              {kindLabel(k)}
            </Link>
          </Button>
        ))}
        <form action={base} className="ml-auto flex gap-2">
          <input type="hidden" name="status" value={status.label} />
          {kind && <input type="hidden" name="kind" value={kind} />}
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Search titles"
            className="h-8 rounded-md border px-2 text-sm"
          />
        </form>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead className="w-40">Status</TableHead>
            <TableHead className="w-28">Owner</TableHead>
            <TableHead className="w-36">First seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="text-muted-foreground">{i.id}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <SeverityDot severity={i.severity} />
                  <Link href={`${base}/${i.id}`} className="hover:underline">
                    {i.title}
                  </Link>
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {kindLabel(i.kind)}
                  {i.summary ? ` · ${i.summary.slice(0, 140)}` : ""}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={i.status} />
              </TableCell>
              <TableCell className="text-sm">
                {i.assigneeUserId ? "taken" : i.owner}
              </TableCell>
              <TableCell className="text-sm">
                {formatHst(i.firstSeenAt)}
              </TableCell>
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground py-8 text-center"
              >
                No issues match.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          {page > 1 && (
            <Button asChild size="sm" variant="outline">
              <Link href={href({ page: String(page - 1) })}>Previous</Link>
            </Button>
          )}
          <span>
            Page {page} of {pages} ({data.total})
          </span>
          {page < pages && (
            <Button asChild size="sm" variant="outline">
              <Link href={href({ page: String(page + 1) })}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </>
  );
}
