import { DelayedError, type Job } from "bullmq";

import {
  closeBrowser,
  getPage,
  releasePage,
} from "@/core/crawlers/qpub/browser";
import {
  getIslandCode,
  isBlockedTime,
  msUntilUnblocked,
} from "@/core/crawlers/qpub/config";
import { scrapeTmk } from "@/core/crawlers/qpub/scrape";
import { rawQuery } from "@/lib/mysql/hhdb";

import { enqueueQpubParse } from "../enqueue";
import type { QpubScrapeJobData } from "../queues";

export async function processQpubScrape(
  job: Job<QpubScrapeJobData>,
): Promise<string> {
  const { tmk, url } = job.data;

  // Pause during blocked hours (backup / night)
  if (isBlockedTime()) {
    const delayMs = msUntilUnblocked();
    job.log(`Blocked time window — delaying ${Math.round(delayMs / 60_000)}m`);
    // Close browser while we wait to free resources
    await closeBrowser();
    await job.moveToDelayed(Date.now() + delayMs, job.token);
    throw new DelayedError(
      `Blocked time — retry in ${Math.round(delayMs / 60_000)}m`,
    );
  }

  const page = await getPage();
  try {
    const result = await scrapeTmk(page, tmk, url);
    job.log(
      `${tmk}: ${result.status}${result.error ? ` (${result.error})` : ""}`,
    );

    if (result.status === "success" || result.status === "no_data") {
      await rawQuery(
        `UPDATE scrape_status
         SET scrape_status='success', scraped_at=NOW(), retry_count=0, error=NULL
         WHERE tmk = ?`,
        [tmk],
      );
      // Chain: enqueue parse job after successful scrape
      const island = job.data.island || getIslandCode(tmk);
      await enqueueQpubParse({ tmk, island });
    } else if (result.status === "captcha" || result.status === "blocked") {
      await rawQuery(
        `UPDATE scrape_status
         SET retry_count = retry_count + 1, error = ?
         WHERE tmk = ?`,
        [result.error ?? result.status, tmk],
      );
      // Close browser to get a fresh session on next attempt
      await closeBrowser();
      // Push job to back of queue (5 min delay) instead of blocking on retries
      const delayMs = 5 * 60_000;
      await job.moveToDelayed(Date.now() + delayMs, job.token);
      throw new DelayedError(`${result.status}: ${result.error ?? "detected"}`);
    } else {
      // error status
      await rawQuery(
        `UPDATE scrape_status
         SET scrape_status='failed', retry_count = retry_count + 1, error = ?
         WHERE tmk = ?`,
        [result.error ?? "Unknown scrape error", tmk],
      );
      throw new Error(result.error ?? "Unknown scrape error");
    }

    return `${tmk}: ${result.status}`;
  } finally {
    await releasePage(page);
  }
}
