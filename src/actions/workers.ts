"use server";

import { Queue } from "bullmq";

import { redisConnection } from "@/core/workers/connection";

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
};

export async function getWorkerJobs(): Promise<WorkerJobsResult> {
  const allJobs: SerializedJob[] = [];
  const allWorkers: SerializedWorkerInfo[] = [];
  const counts: Record<string, QueueCounts> = {};

  for (const name of QUEUE_NAMES) {
    const queue = new Queue(name, {
      connection: redisConnection,
      prefix: PREFIX,
    });

    try {
      const [jobs, jobCounts, workers] = await Promise.all([
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

  return { jobs: allJobs, counts, workers: allWorkers };
}

export async function getSchedulers(): Promise<SerializedScheduler[]> {
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
  const queue = new Queue(queueName, {
    connection: redisConnection,
    prefix: PREFIX,
  });

  try {
    return await queue.removeJobScheduler(schedulerKey);
  } finally {
    await queue.close();
  }
}

export async function triggerScheduledJob(
  queueName: string,
  jobName: string,
  jobData: Record<string, unknown>,
): Promise<void> {
  const queue = new Queue(queueName, {
    connection: redisConnection,
    prefix: PREFIX,
  });

  try {
    await queue.add(jobName, jobData);
  } finally {
    await queue.close();
  }
}

export async function getJobLogs(
  queueName: string,
  jobId: string,
): Promise<string[]> {
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
