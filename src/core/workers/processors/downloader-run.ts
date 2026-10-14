import type { Job } from "bullmq";

import { runDownloader } from "@/core/downloaders/run";

import type { DownloaderRunJobData } from "../queues";

export async function processDownloaderRun(
  job: Job<DownloaderRunJobData>,
): Promise<string> {
  const { handle, keys, force, full } = job.data;
  const out = await runDownloader(handle, {
    keys,
    force,
    full,
    log: (msg) => void job.log(msg),
  });
  if (out.status === "error") throw new Error(out.message);
  return out.message;
}
