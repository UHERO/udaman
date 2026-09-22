import { AppLogCollection } from "@catalog/collections/app-log-collection";
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
import { WORKER_NAME, workerBindings } from "./worker-identity";

// Ensure all date operations use Hawaii Standard Time.
// Must be set before any module that touches Date is imported.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("worker", workerBindings());

/**
 * Which queues this process consumes. Default: all of them (one process,
 * as before). Production runs two units on the worker host:
 *
 *   udaman-worker        WORKER_QUEUES=default,critical,light
 *   udaman-worker-heavy  WORKER_QUEUES=heavy
 *
 * so a multi-hour reload's synchronous parsing and GC pauses can't stall
 * uploads or clipboard jobs, and a heap death in the reload process can't
 * fail every in-flight upload as "stalled" (2026-08-31). Exactly one
 * process may consume `heavy`, at concurrency 1 — the MySQL lock guards
 * against the web host, not against a second heavy worker.
 */
const ALL_QUEUES = ["default", "heavy", "critical", "light"] as const;
type QueueName = (typeof ALL_QUEUES)[number];
const QUEUES: QueueName[] = (process.env.WORKER_QUEUES ?? ALL_QUEUES.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter((s): s is QueueName => (ALL_QUEUES as readonly string[]).includes(s));
if (QUEUES.length === 0) {
  throw new Error(
    `WORKER_QUEUES="${process.env.WORKER_QUEUES}" names no known queue (${ALL_QUEUES.join(", ")})`,
  );
}
const consumes = (q: QueueName) => QUEUES.includes(q);

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

/**
 * Queue wait and run time for a finished job, from BullMQ's own stamps.
 * `timestamp` is enqueue time (for a scheduled job, when the cron fired).
 */
function jobTiming(job: Job) {
  const now = Date.now();
  const processedOn = job.processedOn ?? now;
  return {
    waitMs: job.timestamp ? Math.max(0, processedOn - job.timestamp) : null,
    runMs: Math.max(0, (job.finishedOn ?? now) - processedOn),
  };
}

/**
 * One app_logs row per finished job (category "worker", name = job name).
 * This is what /admin/perf charts: durations of the scheduled jobs over
 * time, queue wait per queue, worker RSS after each job. Fire-and-forget.
 */
function recordJob(
  queue: string,
  job: Job,
  status: "completed" | "failed",
  err?: string,
) {
  void AppLogCollection.log({
    level: status === "failed" ? "error" : "info",
    category: "worker",
    name: job.name,
    subject: "job",
    metadata: {
      queue,
      jobId: job.id ?? null,
      worker: WORKER_NAME,
      status,
      ...jobTiming(job),
      ...memStats(),
      ...(status === "completed"
        ? { result: String(job.returnvalue ?? "").slice(0, 500) }
        : { err: (err ?? "").slice(0, 500) }),
    },
  });
}

// ─── Dispatch function ───────────────────────────────────────────────

const dispatch = async (job: Job): Promise<string> => {
  const handler = processors[job.name];
  if (!handler) throw new Error(`No processor for job: ${job.name}`);
  return handler(job);
};

// ─── Workers ─────────────────────────────────────────────────────────

// Shared by every worker. lockDuration is long so a long-running job can't
// be marked stalled and silently retried while still in flight (which
// compounds OOM and double-writes data points); maxStalledCount 0 means a
// job that does stall fails outright instead of re-running. removeOn*
// caps what BullMQ keeps in Redis.
const workerOpts = {
  connection: redisConnection,
  prefix: "udaman",
  lockDuration: 600_000, // 10 min
  lockRenewTime: 60_000,
  stalledInterval: 120_000,
  maxStalledCount: 0,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
} as const;

const CONCURRENCY: Record<QueueName, number> = {
  // Keep this low: reload steps hold many Series instances in memory
  // while EvalExecutor runs.
  default: 2,
  // Lock-holding jobs (reloads, sweeps, dependency reset, archive/purge).
  // Must stay 1: BullMQ serializes them FIFO and none ever sits in a slot
  // waiting on the DB lock; two here would re-create that starvation.
  heavy: 1,
  // Uploads are memory-intensive (XLSX parsing).
  critical: 1,
  // Interactive jobs (clipboard actions, single-series reloads): short,
  // single-series, safe beside a locked heavy job.
  light: 2,
};

const workers = new Map<QueueName, Worker>();
for (const name of QUEUES) {
  workers.set(
    name,
    new Worker(name, dispatch, { ...workerOpts, concurrency: CONCURRENCY[name] }),
  );
}

// ─── Lifecycle logging ───────────────────────────────────────────────

for (const [name, worker] of workers) {
  worker.on("completed", (job) => {
    log.info(
      { queue: name, jobId: job.id, jobName: job.name, ...memStats() },
      "Job completed",
    );
    recordJob(name, job, "completed");
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
    if (job) recordJob(name, job, "failed", err.message);
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

// Schedules live in Redis per queue, so any process can register them;
// upserts are idempotent. Do it from the process that consumes `default`
// (the original single worker) unless WORKER_SCHEDULES overrides.
const registersSchedules =
  process.env.WORKER_SCHEDULES != null
    ? process.env.WORKER_SCHEDULES === "1"
    : consumes("default");
if (registersSchedules) {
  registerSchedules().catch((err) => {
    log.error({ err: err.message }, "Failed to register schedules");
  });
}

// Stamp any upload rows orphaned by a previous worker crash/restart.
// Upload jobs run on `critical`, so only that process reconciles them.
if (consumes("critical")) {
  reconcileProcessingUploads().catch((err) => {
    log.error({ err: err.message }, "Upload reconciliation failed");
  });
}

// ─── Graceful shutdown ───────────────────────────────────────────────

async function shutdown() {
  log.info("Shutting down workers...");
  await Promise.all([...workers.values()].map((w) => w.close()));
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
  { queues: QUEUES, schedules: registersSchedules },
  `Worker process started — listening on ${QUEUES.map((q) => `udaman/${q}`).join(", ")}`,
);
