import { Job, Worker } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import { redisConnection } from "./connection";
import { processors } from "./processors";
import { registerSchedules } from "./scheduler";
import {
  isUploadJob,
  reconcileProcessingUploads,
  stampUploadFailed,
} from "./upload-status";
import { workerBindings } from "./worker-identity";

// Ensure all date operations use Hawaii Standard Time.
// Must be set before any module that touches Date is imported.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("worker", workerBindings());

/**
 * Process memory snapshot attached to job lifecycle logs. The worker has
 * repeatedly grown to ~6 GB RSS over hours of normal work and then died in
 * a JSC GC sweep (SIGILL, 2026-08-31); logging rss/heap per job shows
 * whether growth tracks a specific job type or just process lifetime.
 */
function memStats() {
  const m = process.memoryUsage();
  const mb = (n: number) => Math.round(n / 1048576);
  return { rssMB: mb(m.rss), heapMB: mb(m.heapUsed), extMB: mb(m.external) };
}

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

// Interactive jobs (clipboard actions, single-series reloads). Separate
// worker so a heavy job waiting on the cross-process DB lock — which
// occupies a default-queue slot for up to the lock timeout — can never
// starve them. These jobs are short and touch single series, so they are
// safe to run alongside a locked heavy job.
const lightWorker = new Worker("light", dispatch, {
  connection: redisConnection,
  prefix: "udaman",
  concurrency: 2,
  lockDuration: 600_000,
  lockRenewTime: 60_000,
  stalledInterval: 120_000,
  maxStalledCount: 0,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
});

// ─── Lifecycle logging ───────────────────────────────────────────────

for (const [name, worker] of [
  ["default", defaultWorker],
  ["critical", criticalWorker],
  ["light", lightWorker],
] as const) {
  worker.on("completed", (job) => {
    log.info(
      { queue: name, jobId: job.id, jobName: job.name, ...memStats() },
      "Job completed",
    );
  });

  worker.on("failed", (job, err) => {
    log.error(
      {
        queue: name,
        jobId: job?.id,
        jobName: job?.name,
        err: err.message,
        ...memStats(),
      },
      "Job failed",
    );
    // Upload rows are what the UI polls; make sure the failure reaches
    // them even if the DB was the thing that failed (retries with backoff).
    if (job && isUploadJob(job.name)) {
      const uploadId = (job.data as { uploadId?: number }).uploadId;
      if (uploadId != null) {
        void stampUploadFailed(job.name, uploadId, err.message);
      }
    }
  });

  worker.on("error", (err) => {
    log.error({ queue: name, err: err.message }, "Worker error");
  });
}

// ─── Register cron schedules ─────────────────────────────────────────

registerSchedules().catch((err) => {
  log.error({ err: err.message }, "Failed to register schedules");
});

// Stamp any upload rows orphaned by a previous worker crash/restart.
reconcileProcessingUploads().catch((err) => {
  log.error({ err: err.message }, "Upload reconciliation failed");
});

// ─── Graceful shutdown ───────────────────────────────────────────────

async function shutdown() {
  log.info("Shutting down workers...");
  await Promise.all([
    defaultWorker.close(),
    criticalWorker.close(),
    lightWorker.close(),
  ]);
  log.info("Workers shut down");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// A lost DB connection surfacing as a stray rejection (e.g. from a pool
// callback after the server dropped us) must not exit the process: BullMQ
// has already failed the job, and a crash costs a 10 s systemd restart plus
// every other in-flight job (maxStalledCount: 0 → they fail, not retry).
// Log loudly and keep serving.
process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  log.error({ err: err.message, stack: err.stack }, "Unhandled rejection");
});
process.on("uncaughtException", (err) => {
  log.error({ err: err.message, stack: err.stack }, "Uncaught exception");
});

log.info(
  "Worker process started — listening on udaman/default, udaman/critical and udaman/light",
);
