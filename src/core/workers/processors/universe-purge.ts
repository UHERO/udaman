import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import UniverseCollection from "@catalog/collections/universe-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";
import { getDataDir } from "@/lib/data-dir";

import type { UniversePurgeJobData } from "../queues";

const log = createLogger("worker.universe-purge");

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Check that an archive directory for this universe exists in the backup
 * directory and was created within the last 24 hours.
 * Matches both the new CSV directory format (YYYYMMDD-{universe}-archive/)
 * and the legacy XLSX format (YYYYMMDD-{universe}-archive.xlsx).
 */
async function verifyRecentArchive(universe: string): Promise<string | null> {
  const backupDir = join(getDataDir(), "backup");
  let entries: string[];
  try {
    entries = await readdir(backupDir);
  } catch {
    return null;
  }

  const pattern = new RegExp(`^\\d{8}-${universe}-archive(\\.xlsx)?$`);
  const matches = entries.filter((f) => pattern.test(f));
  if (matches.length === 0) return null;

  // Find the most recent one
  let newest: string | null = null;
  let newestMtime = 0;
  for (const entry of matches) {
    const entryPath = join(backupDir, entry);
    const info = await stat(entryPath);
    if (info.mtimeMs > newestMtime) {
      newestMtime = info.mtimeMs;
      newest = entryPath;
    }
  }

  if (!newest) return null;

  const ageMs = Date.now() - newestMtime;
  if (ageMs > TWENTY_FOUR_HOURS_MS) {
    log.warn(
      { universe, path: newest, ageHours: +(ageMs / 3_600_000).toFixed(1) },
      "Most recent archive is older than 24 hours",
    );
    return null;
  }

  return newest;
}

export async function processUniversePurge(
  job: Job<UniversePurgeJobData>,
): Promise<string> {
  const { universe } = job.data;
  const start = Date.now();
  log.info({ universe }, "Starting universe purge");
  job.log(`Purging universe ${universe}...`);

  // Safeguard: require a recent archive
  const archivePath = await verifyRecentArchive(universe);
  if (!archivePath) {
    const msg =
      `Purge aborted: no archive for ${universe} found within the last 24 hours. ` +
      `Run an archive first, then retry.`;
    log.error({ universe }, msg);
    job.log(msg);
    throw new Error(msg);
  }

  job.log(`Verified recent archive: ${archivePath}`);
  log.info(
    { universe, archivePath },
    "Recent archive verified, proceeding with purge",
  );

  const { deleted, skipped } = await UniverseCollection.deleteUniverse(
    universe,
    (step) => job.log(step),
  );

  const durationMs = Date.now() - start;
  const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);
  const msg = `Purge complete: ${totalDeleted} records deleted across ${Object.keys(deleted).length} tables (${durationMs}ms)`;
  log.info({ universe, deleted, skipped, durationMs }, msg);
  job.log(msg);
  if (Object.keys(skipped).length > 0) {
    job.log(`Skipped (shared): ${JSON.stringify(skipped)}`);
  }
  return msg;
}
