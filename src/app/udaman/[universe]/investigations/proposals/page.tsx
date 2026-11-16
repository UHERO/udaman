import Link from "next/link";

import { canReviewProposals, listOpsProposals } from "@/actions/ops";
import { ProposalCard } from "@/components/ops/proposal-card";
import { Button } from "@/components/ui/button";
import type { ProposalStatus } from "@/core/ops/types";

const VIEWS: Array<{ label: string; status: ProposalStatus[] }> = [
  { label: "Open", status: ["pending", "queued"] },
  { label: "Applied", status: ["applied", "approved"] },
  { label: "Rejected", status: ["rejected"] },
  {
    label: "Withdrawn / stale / failed",
    status: ["withdrawn", "stale", "failed"],
  },
];

export default async function ProposalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { universe } = await params;
  const { view } = await searchParams;
  const current = VIEWS.find((v) => v.label === view) ?? VIEWS[0];
  const proposals = await listOpsProposals(universe, current.status);
  const canReview = await canReviewProposals(universe);
  const base = `/udaman/${universe}/investigations/proposals`;

  const pending = proposals.filter((p) => p.status === "pending");
  const queued = proposals.filter((p) => p.status !== "pending");

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Proposals</h1>
        <p className="text-muted-foreground text-sm">
          Changes the agent (or a dev) proposed. One is up for review at a time;
          the next appears as soon as it is approved or rejected, or the issue
          is fixed another way. Load errors come before metadata.
          {!canReview && " Only reviewers can approve."}
        </p>
      </div>
      <div className="flex gap-2">
        {VIEWS.map((v) => (
          <Button
            key={v.label}
            asChild
            size="sm"
            variant={v.label === current.label ? "default" : "outline"}
          >
            <Link href={`${base}?view=${encodeURIComponent(v.label)}`}>
              {v.label}
            </Link>
          </Button>
        ))}
      </div>
      {current.label === "Open" ? (
        <>
          <h2 className="text-lg font-semibold">Up for review</h2>
          {pending.length ? (
            pending.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                universe={universe}
                canReview={canReview}
              />
            ))
          ) : (
            <p className="text-muted-foreground text-sm">
              Nothing waiting for review.
            </p>
          )}
          {queued.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">
                Ready next ({queued.length})
              </h2>
              {queued.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  universe={universe}
                  canReview={canReview}
                />
              ))}
            </>
          )}
        </>
      ) : proposals.length ? (
        proposals.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            universe={universe}
            canReview={false}
          />
        ))
      ) : (
        <p className="text-muted-foreground text-sm">None.</p>
      )}
    </>
  );
}
