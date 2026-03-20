import { Worker, type Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import { closeBrowser } from "../crawlers/qpub/browser";
import { redisConnection } from "./connection";
import { processQpubLoad } from "./processors/qpub-load";
import { processQpubParse } from "./processors/qpub-parse";
import { processQpubReparse } from "./processors/qpub-reparse";
import { processQpubScrape } from "./processors/qpub-scrape";
import { processQpubSeed } from "./processors/qpub-seed";
import { JobName } from "./queues";

const log = createLogger("scraper-worker");

// ─── Dispatch ─────────────────────────────────────────────────────────

const handlers: Record<string, (job: Job) => Promise<string>> = {
  [JobName.QPUB_SCRAPE]: processQpubScrape,
  [JobName.QPUB_SEED]: processQpubSeed,
  [JobName.QPUB_PARSE]: processQpubParse,
  [JobName.QPUB_LOAD]: processQpubLoad,
  [JobName.QPUB_REPARSE]: processQpubReparse,
};

const dispatch = async (job: Job): Promise<string> => {
  const handler = handlers[job.name];
  if (!handler) throw new Error(`No processor for job: ${job.name}`);
  return handler(job);
};

// ─── Worker ───────────────────────────────────────────────────────────

const concurrency = parseInt(process.env.SCRAPER_CONCURRENCY ?? "1", 10);

const scraperWorker = new Worker("scraper", dispatch, {
  connection: redisConnection,
  prefix: "udaman",
  concurrency,
  lockDuration: 120_000,
  stalledInterval: 60_000,
});

// ─── Lifecycle logging ────────────────────────────────────────────────

scraperWorker.on("completed", (job) => {
  log.info({ jobId: job.id, jobName: job.name }, "Job completed");
});

scraperWorker.on("failed", (job, err) => {
  log.error(
    { jobId: job?.id, jobName: job?.name, err: err.message },
    "Job failed",
  );
});

scraperWorker.on("error", (err) => {
  log.error({ err: err.message }, "Worker error");
});

// ─── Graceful shutdown ────────────────────────────────────────────────

async function shutdown() {
  log.info("Shutting down scraper worker...");
  await closeBrowser();
  await scraperWorker.close();
  log.info("Scraper worker shut down");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

log.info("Scraper worker started — listening on udaman/scraper");
