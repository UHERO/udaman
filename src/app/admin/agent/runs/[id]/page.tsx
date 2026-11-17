import Link from "next/link";
import { notFound } from "next/navigation";
import { formatHst } from "@catalog/utils/time";

import { getAgentRunSteps } from "@/actions/ops";
import { requireAuth } from "@/lib/auth/dal";

export default async function AgentRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  if (session.user.role !== "dev") notFound();
  const { id } = await params;
  const steps = await getAgentRunSteps(Number(id));

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/agent"
          className="text-muted-foreground text-sm hover:underline"
        >
          ← Agent
        </Link>
        <h1 className="text-2xl font-bold">Run #{id}</h1>
        <p className="text-muted-foreground text-sm">{steps.length} steps</p>
      </div>
      <ol className="space-y-2">
        {steps.map((s) => (
          <li
            key={String(s.id)}
            className={`rounded border p-2 text-sm ${s.is_error ? "border-red-400" : ""}`}
          >
            <div className="text-muted-foreground text-xs">
              #{String(s.seq)} · {formatHst(String(s.created_at), "HH:mm:ss")} ·{" "}
              {String(s.kind)}
              {s.tool_name ? ` · ${String(s.tool_name)}` : ""}
              {s.issue_id ? (
                <>
                  {" · "}
                  <Link
                    className="hover:underline"
                    href={`/udaman/uhero/investigations/issues/${s.issue_id}`}
                  >
                    issue #{String(s.issue_id)}
                  </Link>
                </>
              ) : null}
              {s.duration_ms != null ? ` · ${String(s.duration_ms)}ms` : ""}
              {s.cost_usd != null ? ` · $${Number(s.cost_usd).toFixed(4)}` : ""}
            </div>
            {s.input ? (
              <details>
                <summary className="cursor-pointer text-xs">input</summary>
                <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
                  {String(s.input)}
                </pre>
              </details>
            ) : null}
            {s.output ? (
              <details open={s.kind === "assistant"}>
                <summary className="cursor-pointer text-xs">output</summary>
                <pre className="bg-muted max-h-96 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
                  {String(s.output)}
                </pre>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
