import type { Job } from "bullmq";

import { buildUrl, type IslandCode, ISLANDS } from "@/core/crawlers/qpub/config";
import { rawQuery } from "@/lib/mysql/hhdb";

import type { QpubSeedJobData } from "../queues";
import { enqueueQpubScrape } from "../enqueue";

type SeedRow = {
  tmk: string;
  island_code: string;
};

export async function processQpubSeed(
  job: Job<QpubSeedJobData>,
): Promise<string> {
  // 1. Query the 3000 oldest-scraped rows, joining properties for island_code
  const rows = await rawQuery<SeedRow>(
    `SELECT s.tmk, p.island_code
     FROM scrape_status s
     JOIN properties p ON s.tmk = p.tmk
     ORDER BY s.scraped_at ASC
     LIMIT 3000`,
  );

  job.log(`Found ${rows.length} TMKs to seed`);

  if (rows.length === 0) {
    return "No TMKs to seed";
  }

  // 2. Reset statuses for selected rows in a single UPDATE
  const tmks = rows.map((r) => r.tmk);
  const placeholders = tmks.map(() => "?").join(",");
  await rawQuery(
    `UPDATE scrape_status
     SET scrape_status='pending', parse_status='pending', load_status='pending',
         retry_count=0, error=NULL
     WHERE tmk IN (${placeholders})`,
    tmks,
  );

  job.log(`Reset ${tmks.length} rows to pending`);

  // 3. Enqueue a scrape job for each TMK
  let enqueued = 0;
  for (const row of rows) {
    const islandCode = row.island_code as IslandCode;
    if (!(islandCode in ISLANDS)) continue;

    const url = buildUrl(row.tmk, islandCode);
    await enqueueQpubScrape({ tmk: row.tmk, url, island: islandCode });
    enqueued++;

    if (enqueued % 500 === 0) {
      job.log(`Enqueued ${enqueued}/${rows.length}`);
    }
  }

  return `Enqueued ${enqueued} scrape jobs`;
}
