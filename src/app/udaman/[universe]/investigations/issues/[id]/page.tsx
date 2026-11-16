import Link from "next/link";
import { notFound } from "next/navigation";
import { formatHst } from "@catalog/utils/time";

import { getOpsIssue } from "@/actions/ops";
import { IssueActions } from "@/components/ops/issue-actions";
import {
  KindBadge,
  SeverityDot,
  StatusBadge,
} from "@/components/ops/ops-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserContext } from "@/lib/auth/dal";

const EVENT_LABEL: Record<string, string> = {
  detected: "Detected",
  recurred: "Came back",
  diagnosis: "Diagnosis",
  comment: "Comment",
  question: "Question",
  proposal_created: "Proposed a change",
  proposal_reviewed: "Reviewed proposal",
  proposal_withdrawn: "Proposal withdrawn",
  action_applied: "Change applied",
  resolution_claimed: "Claimed resolved",
  claim_rejected: "Still present",
  verified_resolved: "Resolved (verified)",
  condition_cleared: "Condition cleared",
  reopened: "Reopened",
  snoozed: "Snoozed",
  dismissed: "Dismissed",
  assigned: "Assigned",
  closed: "Closed",
};

export default async function IssuePage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { universe, id } = await params;
  const data = await getOpsIssue(Number(id));
  if (!data) notFound();
  const { issue, events, proposals } = data;
  const { role, userId } = await getCurrentUserContext();
  const isDev = role === "dev" || role === "admin";

  const seriesId =
    issue.subjectType === "series"
      ? issue.subjectId
      : ((issue.detail?.seriesId as number | undefined) ?? null);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/udaman/${universe}/investigations/issues`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← Issues
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <SeverityDot severity={issue.severity} />#{issue.id} {issue.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={issue.status} />
          <KindBadge kind={issue.kind} />
          <span className="text-muted-foreground">
            owner {issue.assigneeUserId ? "a person (taken)" : issue.owner} ·
            first seen {formatHst(issue.firstSeenAt)} · last seen{" "}
            {formatHst(issue.lastSeenAt)} · seen {issue.occurrenceCount}×
            {issue.reopenCount ? ` · reopened ${issue.reopenCount}×` : ""}
          </span>
          {seriesId && (
            <Link
              href={`/udaman/${universe}/series/${seriesId}`}
              className="hover:underline"
            >
              Open series →
            </Link>
          )}
          {issue.subjectType === "measurement" && issue.subjectId && (
            <Link
              href={`/udaman/${universe}/catalog/measurements/${issue.subjectId}`}
              className="hover:underline"
            >
              Open measurement →
            </Link>
          )}
        </div>
      </div>

      {issue.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest diagnosis</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {issue.summary}
          </CardContent>
        </Card>
      )}

      {issue.resolvedAt && (
        <p className="text-sm">
          Resolved {formatHst(issue.resolvedAt)} via{" "}
          <strong>{issue.resolutionPath}</strong>
          {issue.resolutionNote ? `: ${issue.resolutionNote}` : ""}
        </p>
      )}
      {issue.dismissedReason && (
        <p className="text-sm">Dismissed: {issue.dismissedReason}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Act on it</CardTitle>
        </CardHeader>
        <CardContent>
          <IssueActions
            issueId={issue.id}
            status={issue.status}
            taken={issue.assigneeUserId != null}
            takenByMe={issue.assigneeUserId === Number(userId)}
            isDev={isDev}
          />
        </CardContent>
      </Card>

      {proposals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {proposals.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                <span>
                  #{p.id} {p.kind}: {p.summary}
                </span>
              </div>
            ))}
            <Link
              href={`/udaman/${universe}/investigations/proposals`}
              className="hover:underline"
            >
              Review proposals →
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="border-l-2 pl-3 text-sm">
                <div className="text-muted-foreground text-xs">
                  {formatHst(e.createdAt)} · {EVENT_LABEL[e.type] ?? e.type} ·{" "}
                  {e.actorType === "user"
                    ? (e.actorEmail ?? `user ${e.actorUserId}`)
                    : e.actorType}{" "}
                  via {e.via}
                </div>
                {e.body && (
                  <div className="mt-1 whitespace-pre-wrap">{e.body}</div>
                )}
                {e.payload && e.type === "detected" && (
                  <pre className="bg-muted mt-1 max-h-48 overflow-auto rounded p-2 text-xs">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
