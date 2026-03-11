"use server";

import { Queue } from "bullmq";

import type {
  JobState,
  SerializedJob,
  SerializedWorkerInfo,
} from "@/actions/workers";
import { redisConnection } from "@/core/workers/connection";
import { enqueueQpubSeed } from "@/core/workers/enqueue";
import { requirePermission } from "@/lib/auth/permissions";
import { rawQuery } from "@/lib/mysql/hhdb";

const QUEUE_NAME = "scraper";
const PREFIX = "udaman";

// ─── DB Stats types ──────────────────────────────────────────────

export type PipelineStatusCounts = {
  pending: number;
  success: number;
  failed: number;
};

export type QpubDbStats = {
  scrapedToday: number;
  scrapedThisMonth: number;
  scrape: PipelineStatusCounts;
  parse: PipelineStatusCounts;
  load: PipelineStatusCounts;
};

// ─── Queue Status types ──────────────────────────────────────────

export type QpubScraperStatus = {
  jobs: SerializedJob[];
  counts: Record<string, number>;
  workers: SerializedWorkerInfo[];
};

// ─── DB Stats action ─────────────────────────────────────────────

export async function getQpubDbStats(): Promise<QpubDbStats> {
  await requirePermission("worker", "read");

  type StatusRow = { status: string; cnt: number };

  const [scrapeRows, parseRows, loadRows, recentRows] = await Promise.all([
    rawQuery<StatusRow>(
      `SELECT scrape_status AS status, COUNT(*) AS cnt FROM scrape_status GROUP BY scrape_status`,
    ),
    rawQuery<StatusRow>(
      `SELECT parse_status AS status, COUNT(*) AS cnt FROM scrape_status GROUP BY parse_status`,
    ),
    rawQuery<StatusRow>(
      `SELECT load_status AS status, COUNT(*) AS cnt FROM scrape_status GROUP BY load_status`,
    ),
    rawQuery<{ scraped_today: number; scraped_this_month: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN DATE(scraped_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS scraped_today,
        COALESCE(SUM(CASE WHEN scraped_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 ELSE 0 END), 0) AS scraped_this_month
      FROM scrape_status
      WHERE scraped_at IS NOT NULL
    `),
  ]);

  function toCounts(rows: StatusRow[]): PipelineStatusCounts {
    const counts: PipelineStatusCounts = { pending: 0, success: 0, failed: 0 };
    for (const row of rows) {
      const key = row.status as keyof PipelineStatusCounts;
      if (key in counts) counts[key] = Number(row.cnt);
    }
    return counts;
  }

  return {
    scrapedToday: Number(recentRows[0]?.scraped_today ?? 0),
    scrapedThisMonth: Number(recentRows[0]?.scraped_this_month ?? 0),
    scrape: toCounts(scrapeRows),
    parse: toCounts(parseRows),
    load: toCounts(loadRows),
  };
}

// ─── Queue Status action ─────────────────────────────────────────

export async function getQpubScraperStatus(): Promise<QpubScraperStatus> {
  await requirePermission("worker", "read");

  const queue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
    prefix: PREFIX,
  });

  try {
    const [jobs, counts, workers] = await Promise.all([
      queue.getJobs(["active", "completed", "failed"], 0, 49),
      queue.getJobCounts("active", "waiting", "delayed", "completed", "failed"),
      queue.getWorkers().catch(() => [] as Record<string, string>[]),
    ]);

    const serializedWorkers: SerializedWorkerInfo[] = workers.map((w) => ({
      id: w.id ?? "",
      addr: w.addr ?? "",
      name: w.name ?? "",
      age: parseInt(w.age ?? "0", 10),
      idle: parseInt(w.idle ?? "0", 10),
      queue: QUEUE_NAME,
    }));

    const serializedJobs: SerializedJob[] = [];
    for (const job of jobs) {
      if (!job.id) continue;
      const state = await job.getState();
      serializedJobs.push({
        id: job.id,
        queue: QUEUE_NAME,
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

    serializedJobs.sort((a, b) => b.timestamp - a.timestamp);

    return { jobs: serializedJobs, counts, workers: serializedWorkers };
  } finally {
    await queue.close();
  }
}

// ─── Seed & Drain actions ────────────────────────────────────────

export async function seedQpubScraper(): Promise<void> {
  await requirePermission("worker", "execute");
  await enqueueQpubSeed();
}

/**
 * Wipe all jobs from the scraper queue (waiting, delayed, completed, failed).
 * Active jobs are left to finish. Use this before reseeding with corrected URLs.
 */
export async function drainScraperQueue(): Promise<number> {
  await requirePermission("worker", "execute");

  const queue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
    prefix: PREFIX,
  });

  try {
    // Get counts before draining so we can report how many were removed
    const counts = await queue.getJobCounts(
      "waiting",
      "delayed",
      "completed",
      "failed",
    );
    const total =
      counts.waiting + counts.delayed + counts.completed + counts.failed;

    // drain() removes all waiting and delayed jobs
    await queue.drain();

    // clean() removes completed/failed jobs (grace period 0 = all)
    await queue.clean(0, 0, "completed");
    await queue.clean(0, 0, "failed");

    return total;
  } finally {
    await queue.close();
  }
}
