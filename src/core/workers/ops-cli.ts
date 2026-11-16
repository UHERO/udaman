/**
 * Ops CLI (runs where the database is: a server or a dev machine).
 *
 *   bun run ops reconcile [--daily]   run the detectors now (--daily: also re-check
 *                                     waiting proposals and post the digest)
 *   bun run ops status                issue counts, queue, budget
 *   bun run ops token <name>          create an agent service token (printed once)
 *
 * The agent itself runs elsewhere: `bun run ops-agent` (src/core/ops-agent).
 */

import { IssueStore } from "@/core/ops/issue-store";
import { ProposalStore } from "@/core/ops/proposal-store";
import { reconcile } from "@/core/ops/reconciler";
import { getBudget } from "@/core/ops/runs";
import { createServiceToken } from "@/core/ops/service-tokens";
import { getOpsSettings } from "@/core/ops/settings";

process.env.TZ = "Pacific/Honolulu";

const UNIVERSE = "UHERO";

async function run(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "reconcile": {
      const s = await reconcile(UNIVERSE, { daily: rest.includes("--daily") });
      console.log(JSON.stringify(s, null, 2));
      break;
    }
    case "status": {
      const [counts, pending, queued, budget, settings] = await Promise.all([
        IssueStore.counts(UNIVERSE),
        ProposalStore.list({ universe: UNIVERSE, status: ["pending"] }),
        ProposalStore.list({ universe: UNIVERSE, status: ["queued"] }),
        getBudget(UNIVERSE),
        getOpsSettings(UNIVERSE),
      ]);
      console.log(
        JSON.stringify(
          {
            counts,
            pending: pending.map((p) => `#${p.id} ${p.summary}`),
            queued: queued.length,
            budget,
            settings,
          },
          null,
          2,
        ),
      );
      break;
    }
    case "token": {
      const name = rest.join(" ") || "ops agent";
      // Created by the agent user itself when run from the CLI.
      const { id, token } = await createServiceToken(name, 0);
      console.log(
        `Token #${id} (${name}). Shown once; set OPS_MCP_TOKEN on the workstation:\n${token}`,
      );
      break;
    }
    default:
      console.log(
        "Usage: bun run ops reconcile [--daily] | status | token <name>",
      );
      process.exitCode = cmd ? 1 : 0;
  }
}

await run();
process.exit(process.exitCode ?? 0);
