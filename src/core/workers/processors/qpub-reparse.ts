import { readFileSync } from "fs";

import type { Job } from "bullmq";

import {
  getFileMtime,
  listHtmlFiles,
  tmkFromFilePath,
} from "@/core/crawlers/qpub/config";
import { parsePropertyHTML } from "@/core/crawlers/qpub/parse";

import type { QpubReparseJobData } from "../queues";
import { TABLE_LOADERS } from "./qpub-load";

export async function processQpubReparse(
  job: Job<QpubReparseJobData>,
): Promise<string> {
  const { table, island, period, batchSize = 500 } = job.data;

  // Validate table name
  const loader = TABLE_LOADERS[table];
  if (!loader) {
    const valid = Object.keys(TABLE_LOADERS).join(", ");
    throw new Error(`Unknown table "${table}". Valid tables: ${valid}`);
  }

  let processed = 0;
  let loaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const filePath of listHtmlFiles(period, island)) {
    processed++;

    try {
      const tmk = tmkFromFilePath(filePath);
      const html = readFileSync(filePath, "utf-8");
      const parsed = parsePropertyHTML(html, tmk);

      // Skip non-success and non-condo_project pages
      if (parsed.status !== "success" && parsed.status !== "condo_project") {
        skipped++;
        continue;
      }

      // For the condominium loader, only process condo_project pages
      if (table === "condominium" && parsed.status !== "condo_project") {
        skipped++;
        continue;
      }

      const fileMtime = getFileMtime(filePath);
      await loader(tmk, parsed, fileMtime);
      loaded++;
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      job.log(`Error processing ${filePath}: ${msg}`);
    }

    // Report progress
    if (processed % batchSize === 0) {
      const progress = { processed, loaded, skipped, errors };
      await job.updateProgress(progress);
      job.log(
        `Progress: ${processed} processed, ${loaded} loaded, ${skipped} skipped, ${errors} errors`,
      );
    }
  }

  const summary = `Reparse ${table}: ${processed} processed, ${loaded} loaded, ${skipped} skipped, ${errors} errors`;
  job.log(summary);
  await job.updateProgress({ processed, loaded, skipped, errors });
  return summary;
}
