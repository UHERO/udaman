import type { Job } from "bullmq";

import { runExtract, runFetch } from "@/core/ingest/run";

import type { IngestExtractJobData, IngestFetchJobData } from "../queues";

export async function processIngestFetch(
  job: Job<IngestFetchJobData>,
): Promise<string> {
  const { handle, force, full, triggeredBy } = job.data;
  const out = await runFetch(handle, {
    force,
    full,
    triggeredBy: triggeredBy ?? (job.repeatJobKey ? "schedule" : null),
    log: (msg) => void job.log(msg),
  });
  const lines = [out.message, ...out.extractions.map((e) => e.message)];
  if (
    out.status === "failed" ||
    out.extractions.some((e) => e.status === "failed")
  ) {
    throw new Error(lines.join("\n"));
  }
  return lines.join("\n");
}

export async function processIngestExtract(
  job: Job<IngestExtractJobData>,
): Promise<string> {
  const { handle, force, triggeredBy } = job.data;
  const out = await runExtract(handle, {
    force,
    triggeredBy: triggeredBy ?? null,
    log: (msg) => void job.log(msg),
  });
  if (out.status === "failed") throw new Error(out.message);
  return out.message;
}
