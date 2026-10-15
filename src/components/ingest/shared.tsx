"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import type { ActionResult } from "@/lib/action-result";
import { toastActionError, unwrapAction } from "@/lib/action-result";

export type RunStatus = "running" | "ok" | "unchanged" | "failed";

/** Fetch / extraction run status as a badge. */
export function StatusBadge({
  status,
  accepted,
}: {
  status: RunStatus | null | undefined;
  accepted?: boolean;
}) {
  if (!status)
    return <span className="text-muted-foreground text-xs">never run</span>;
  if (status === "failed") return <Badge variant="destructive">failed</Badge>;
  if (status === "running") return <Badge variant="outline">running</Badge>;
  if (status === "unchanged")
    return <Badge variant="secondary">unchanged</Badge>;
  return <Badge>{accepted ? "ok (accepted)" : "ok"}</Badge>;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Run a server action that returns an ActionResult: toast its message,
 * refresh the page's server data, toast the failure otherwise.
 */
export function useIngestAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<{ message: string }>>) =>
    start(async () => {
      try {
        const res = unwrapAction(await fn());
        toast.success(res.message);
        router.refresh();
      } catch (e) {
        toastActionError(e, "Action failed");
      }
    });
  return { pending, run };
}

/** Scalar entries of a stats object as a definition list. */
export function StatsList({ stats }: { stats: Record<string, unknown> }) {
  const entries = Object.entries(stats).filter(
    ([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v),
  );
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-mono">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
