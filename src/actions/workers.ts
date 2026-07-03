"use server";

import { Queue } from "bullmq";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { redisConnection } from "@/core/workers/connection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.workers");

const QUEUE_NAMES = ["default", "critical"] as const;
const PREFIX = "udaman";

export type JobState =
  | "active"
  | "waiting"
  | "delayed"
  | "completed"
  | "failed";

export type SerializedJob = {
  id: string;
  queue: string;
  name: string;
  data: Record<string, unknown>;
  state: JobState;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  failedReason: string | null;
  attemptsMade: number;
  returnvalue: unknown;
  stacktrace: string[];
};

export type QueueCounts = Record<string, number>;

export type SerializedScheduler = {
  key: string;
  queue: string;
  name: string;
  pattern: string;
  tz: string;
  next: number;
  data: Record<string, unknown>;
};

export type SerializedWorkerInfo = {
  id: string;
  addr: string;
  name: string;
  age: number;
  idle: number;
  queue: string;
};

export type WorkerJobsResult = {
  jobs: SerializedJob[];
  counts: Record<string, QueueCounts>;
  workers: SerializedWorkerInfo[];
  processStartedAt: number | null;
  schedulers: SerializedScheduler[];
};

export async function getWorkerJobs(): Promise<WorkerJobsResult> {
  await requirePermission("worker", "read");
  const allJobs: SerializedJob[] = [];
  const allWorkers: SerializedWorkerInfo[] = [];
  const allSchedulers: SerializedScheduler[] = [];
  const counts: Record<string, QueueCounts> = {};

  for (const name of QUEUE_NAMES) {
    const queue = new Queue(name, {
      connection: redisConnection,
      prefix: PREFIX,
    });

    try {
      const [jobs, jobCounts, workers, schedulers] = await Promise.all([
        queue.getJobs(
          ["active", "waiting", "delayed", "completed", "failed"],
          0,
          49,
        ),
        queue.getJobCounts(
          "active",
          "waiting",
          "delayed",
          "completed",
          "failed",
        ),
        queue.getWorkers().catch(() => [] as Record<string, string>[]),
        queue.getJobSchedulers().catch(() => []),
      ]);

      counts[name] = jobCounts;

      for (const w of workers) {
        allWorkers.push({
          id: w.id ?? "",
          addr: w.addr ?? "",
          name: w.name ?? "",
          age: parseInt(w.age ?? "0", 10),
          idle: parseInt(w.idle ?? "0", 10),
          queue: name,
        });
      }

      for (const s of schedulers) {
        allSchedulers.push({
          key: s.key,
          queue: name,
          name: s.name,
          pattern: s.pattern ?? "",
          tz: s.tz ?? "",
          next: s.next ?? 0,
          data: (s.template?.data as Record<string, unknown>) ?? {},
        });
      }

      for (const job of jobs) {
        if (!job.id) continue;
        const state = await job.getState();
        allJobs.push({
          id: job.id,
          queue: name,
          name: job.name,
          data: job.data as Record<string, unknown>,
          state: state as JobState,
          timestamp: job.timestamp,
          processedOn: job.processedOn ?? null,
          finishedOn: job.finishedOn ?? null,
          failedReason: job.failedReason ?? null,
          attemptsMade: job.attemptsMade,
          returnvalue: job.returnvalue,
          stacktrace: job.stacktrace ?? [],
        });
      }
    } finally {
      await queue.close();
    }
  }

  allJobs.sort((a, b) => b.timestamp - a.timestamp);
  allSchedulers.sort((a, b) => a.next - b.next);

  // Derive process start time from the oldest worker's age (seconds since connection)
  const maxAge = allWorkers.reduce((max, w) => Math.max(max, w.age), 0);
  const processStartedAt = maxAge > 0 ? Date.now() - maxAge * 1000 : null;

  return { jobs: allJobs, counts, workers: allWorkers, processStartedAt, schedulers: allSchedulers };
}

export async function getSchedulers(): Promise<SerializedScheduler[]> {
  await requirePermission("worker", "read");
  const allSchedulers: SerializedScheduler[] = [];

  for (const name of QUEUE_NAMES) {
    const queue = new Queue(name, {
      connection: redisConnection,
      prefix: PREFIX,
    });

    try {
      const schedulers = await queue.getJobSchedulers();
      for (const s of schedulers) {
        allSchedulers.push({
          key: s.key,
          queue: name,
          name: s.name,
          pattern: s.pattern ?? "",
          tz: s.tz ?? "",
          next: s.next ?? 0,
          data: (s.template?.data as Record<string, unknown>) ?? {},
        });
      }
    } finally {
      await queue.close();
    }
  }

  allSchedulers.sort((a, b) => a.next - b.next);
  return allSchedulers;
}

export async function removeScheduler(
  queueName: string,
  schedulerKey: string,
): Promise<boolean> {
  const { userId } = await requirePermission("worker", "execute");
  log.info({ queueName, schedulerKey }, "removeScheduler action called");
  const queue = new Queue(queueName, {
    connection: redisConnection,
    prefix: PREFIX,
  });

  try {
    const result = await queue.removeJobScheduler(schedulerKey);
    log.info({ queueName, schedulerKey }, "removeScheduler action completed");
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "removeScheduler failed");
    AppLogCollection.logError(err, { userId, name: "worker.remove_scheduler" });
    throw err;
  } finally {
    await queue.close();
  }
}

export async function triggerScheduledJob(
  queueName: string,
  jobName: string,
  jobData: Record<string, unknown>,
): Promise<void> {
  const { userId } = await requirePermission("worker", "execute");
  log.info({ queueName, jobName }, "triggerScheduledJob action called");
  const queue = new Queue(queueName, {
    connection: redisConnection,
    prefix: PREFIX,
  });

  try {
    await queue.add(jobName, jobData);
    log.info({ queueName, jobName }, "triggerScheduledJob action completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "triggerScheduledJob failed");
    AppLogCollection.logError(err, { userId, name: "worker.trigger_job" });
    throw err;
  } finally {
    await queue.close();
  }
}

/**
 * Cancel active jobs and drain waiting/delayed jobs from all queues.
 * Completed/failed job history is preserved.
 */
export async function clearJobs(): Promise<{ cancelled: number; drained: number }> {
  const { userId } = await requirePermission("worker", "execute");
  log.info("clearJobs action called");
  let cancelled = 0;
  let drained = 0;

  try {
    for (const name of QUEUE_NAMES) {
      const queue = new Queue(name, {
        connection: redisConnection,
        prefix: PREFIX,
      });

      try {
        // Count waiting + delayed before draining
        const counts = await queue.getJobCounts("waiting", "delayed");
        drained += (counts.waiting ?? 0) + (counts.delayed ?? 0);

        // Cancel active jobs by failing them
        const activeJobs = await queue.getJobs(["active"]);
        for (const job of activeJobs) {
          if (job.id) {
            await job.moveToFailed(new Error("Cancelled by user"), job.token ?? "0", false);
            cancelled++;
          }
        }

        // Remove waiting and delayed jobs
        await queue.drain();
      } finally {
        await queue.close();
      }
    }

    log.info({ cancelled, drained }, "clearJobs action completed");
    return { cancelled, drained };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "clearJobs failed");
    AppLogCollection.logError(err, { userId, name: "worker.clear_jobs" });
    throw err;
  }
}

export async function getJobLogs(
  queueName: string,
  jobId: string,
): Promise<string[]> {
  await requirePermission("worker", "read");
  const queue = new Queue(queueName, {
    connection: redisConnection,
    prefix: PREFIX,
  });

  try {
    const { logs } = await queue.getJobLogs(jobId);
    return logs;
  } finally {
    await queue.close();
  }
}
