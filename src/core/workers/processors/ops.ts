import type { Job } from "bullmq";

import { applyProposal } from "@/core/ops/proposals";
import { reconcile } from "@/core/ops/reconciler";

import type { OpsApplyProposalJobData, OpsReconcileJobData } from "../queues";

/** Detectors, auto-resolve, Slack cleanup; nightly also re-checks proposals. */
export async function processOpsReconcile(
  job: Job<OpsReconcileJobData>,
): Promise<string> {
  const universe = job.data.universe ?? "UHERO";
  const s = await reconcile(universe, { daily: job.data.daily });
  const detected = Object.entries(s.detected)
    .map(([k, n]) => `${k}=${n}`)
    .join(" ");
  return `${universe}: ${detected}; +${s.created} new, ${s.reopened} reopened, ${s.cleared} cleared, ${s.closed} closed${s.proposals ? `; proposals ${s.proposals.kept} kept, ${s.proposals.dropped} withdrawn` : ""}`;
}

/** Apply an approved proposal (queued by reviewProposal). */
export async function processOpsApplyProposal(
  job: Job<OpsApplyProposalJobData>,
): Promise<string> {
  const { results } = await applyProposal(job.data.proposalId);
  const applied = results.filter((r) => r.status === "applied").length;
  return `proposal ${job.data.proposalId}: ${applied}/${results.length} applied`;
}
