import type { Job } from "bullmq";

import { daily } from "@/core/crawlers/mls/pipeline";

import type { MlsDailyJobData } from "../queues";

/**
 * Daily MLS listings scrape. Almost all of its ~15 minutes is spent asleep
 * between requests; it writes to the housing DB, not the UHERO server
 * workload, so it runs unlocked on the default queue like QPUB_REPARSE.
 * Throws (failing the job visibly) on parse-failure or guardrail trips.
 */
export async function processMlsDaily(
  job: Job<MlsDailyJobData>,
): Promise<string> {
  const summary = await daily({ site: job.data.site });
  return JSON.stringify(summary);
}
