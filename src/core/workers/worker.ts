import { Job, Worker } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import { redisConnection } from "./connection";
import { processors } from "./processors";
import { registerSchedules } from "./scheduler";

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
  concurrency: 5,
});

const criticalWorker = new Worker("critical", dispatch, {
  connection: redisConnection,
  prefix: "udaman",
  concurrency: 1,
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
