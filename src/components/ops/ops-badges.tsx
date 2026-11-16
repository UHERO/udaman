import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  open: "destructive",
  investigating: "default",
  awaiting_human: "default",
  resolving: "secondary",
  resolved: "outline",
  closed: "outline",
  dismissed: "outline",
  queued: "secondary",
  pending: "default",
  approved: "secondary",
  applied: "outline",
  failed: "destructive",
  rejected: "outline",
  stale: "outline",
  withdrawn: "outline",
  superseded: "outline",
};

const LABEL: Record<string, string> = {
  awaiting_human: "waiting on a person",
  load_error: "load error",
  reload_job_failed: "reload job failed",
  missing_metadata: "missing metadata",
  agent_finding: "finding",
  loader_lag: "loader lag",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {LABEL[status] ?? status}
    </Badge>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return <Badge variant="secondary">{LABEL[kind] ?? kind}</Badge>;
}

export function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === "high"
      ? "bg-red-500"
      : severity === "low"
        ? "bg-slate-300"
        : "bg-amber-400";
  return (
    <span
      title={`${severity} severity`}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
    />
  );
}

export function kindLabel(kind: string): string {
  return LABEL[kind] ?? kind;
}
