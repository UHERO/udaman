import { Job, Worker } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import { redisConnection } from "./connection";
import { processors } from "./processors";
import { registerSchedules } from "./scheduler";

// Ensure all date operations use Hawaii Standard Time.
// Must be set before any module that touches Date is imported.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("worker");

// ─── Dispatch function ───────────────────────────────────────────────

const dispatch = async (job: Job): Promise<string> => {
  const handler = processors[job.name];
  if (!handler) throw new Error(`No processor for job: ${job.name}`);
  return handler(job);
};

// ─── Workers ─────────────────────────────────────────────────────────

const defaultWorker = new Worker("default", dispatch, {
  connection: redisConnection,
  prefix: "udaman",
  // Keep this low: every series_reload / batch_reload step holds many
  // Series instances (Map<date, value>) in memory while EvalExecutor runs,
  // and concurrent reloads also fight for InnoDB row locks on data_points.
  concurrency: 2,
  // Match criticalWorker so a long-running reload can't be marked stalled
  // and silently retried while still in flight (which compounds OOM and
  // double-writes data points).
  lockDuration: 600_000, // 10 min
  lockRenewTime: 60_000,
  stalledInterval: 120_000,
  maxStalledCount: 0,
  // Cap how many completed/failed jobs BullMQ keeps in Redis so the
  // queue doesn't grow without bound.
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
});

const criticalWorker = new Worker("critical", dispatch, {
  connection: redisConnection,
  prefix: "udaman",
  concurrency: 1,
  // Upload jobs are memory-intensive (XLSX parsing). If the worker is
  // killed mid-job (OOM), fail fast instead of silently re-running.
  lockDuration: 600_000, // 10 min — max time before lock expires
  lockRenewTime: 60_000, // renew lock every 60s (default 15s)
  stalledInterval: 120_000, // check for stalled jobs every 2 min
  maxStalledCount: 0, // do NOT retry stalled jobs — fail immediately
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
});

// ─── Lifecycle logging ───────────────────────────────────────────────

for (const [name, worker] of [
  ["default", defaultWorker],
  ["critical", criticalWorker],
] as const) {
  worker.on("completed", (job) => {
    log.info(
      { queue: name, jobId: job.id, jobName: job.name },
      "Job completed",
    );
  });

  worker.on("failed", (job, err) => {
    log.error(
      { queue: name, jobId: job?.id, jobName: job?.name, err: err.message },
      "Job failed",
    );
  });

  worker.on("error", (err) => {
    log.error({ queue: name, err: err.message }, "Worker error");
  });
}

// ─── Register cron schedules ─────────────────────────────────────────

registerSchedules().catch((err) => {
  log.error({ err: err.message }, "Failed to register schedules");
});

// ─── Graceful shutdown ───────────────────────────────────────────────

async function shutdown() {
  log.info("Shutting down workers...");
  await Promise.all([defaultWorker.close(), criticalWorker.close()]);
  log.info("Workers shut down");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

log.info(
  "Worker process started — listening on udaman/default and udaman/critical",
);
