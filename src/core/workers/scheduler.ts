import { createLogger } from "@/core/observability/logger";

import { defaultQueue, JobName } from "./queues";

const log = createLogger("worker.scheduler");

/**
 * Register cron schedules using BullMQ v5's `upsertJobScheduler`.
 * Called once at worker startup. Idempotent — safe to call on every restart.
 * All cron times are in Pacific/Honolulu (HST, UTC-10, no DST).
 */
export async function registerSchedules(): Promise<void> {
  const tz = "Pacific/Honolulu";

  // ─── Exports ────────────────────────────────────────────────────────

  // TSD Export — daily at 8:50 AM HST
  await defaultQueue.upsertJobScheduler(
    "scheduled:tsd-export",
    { pattern: "50 8 * * *", tz },
    { name: JobName.TSD_EXPORT, data: {} },
  );
  log.info("Registered schedule: tsd-export (daily 8:50 AM HST)");

  // Kauai dashboard export — Saturday 1:00 PM HST
  await defaultQueue.upsertJobScheduler(
    "scheduled:kauai-export",
    { pattern: "0 13 * * 6", tz },
    { name: JobName.KAUAI_EXPORT, data: {} },
  );
  log.info("Registered schedule: kauai-export (Saturday 1:00 PM HST)");

  // ─── Public data ────────────────────────────────────────────────────

  // Update Public Data Points — 4x daily at 11:01 AM, 1:01 PM, 3:01 PM, 5:01 PM HST
  await defaultQueue.upsertJobScheduler(
    "scheduled:update-public",
    { pattern: "1 11,13,15,17 * * *", tz },
    { name: JobName.UPDATE_PUBLIC, data: {} },
  );
  log.info(
    "Registered schedule: update-public (11:01, 13:01, 15:01, 17:01 HST)",
  );

  // ─── Admin / maintenance ────────────────────────────────────────────

  // Reset dependency depth — 6:09 PM HST daily
  await defaultQueue.upsertJobScheduler(
    "scheduled:dependency-reset",
    { pattern: "9 18 * * *", tz },
    { name: JobName.DEPENDENCY_RESET, data: {} },
  );
  log.info("Registered schedule: dependency-reset (daily 6:09 PM HST)");

  // Purge old stuff — 7:40 PM HST daily
  await defaultQueue.upsertJobScheduler(
    "scheduled:purge-old",
    { pattern: "40 19 * * *", tz },
    { name: JobName.PURGE_OLD, data: {} },
  );
  log.info("Registered schedule: purge-old (daily 7:40 PM HST)");

  // ─── Nightly batch reload ───────────────────────────────────────────

  // The (in)famous "Nightly Reload" — 7:44 PM HST daily
  await defaultQueue.upsertJobScheduler(
    "scheduled:batch-reload",
    { pattern: "44 19 * * *", tz },
    {
      name: JobName.BATCH_RELOAD,
      data: {
        excludeSearches: [
          "#load_api_bls",
          "#load_api_bea",
          "#tour_ocup%Y",
          "#sa_jobs.csv",
        ],
        updatePublic: true,
      },
    },
  );
  log.info("Registered schedule: batch-reload (daily 7:44 PM HST)");

  // ─── Targeted reloads ──────────────────────────────────────────────

  // Tour occupancy — 3:00 AM HST daily
  await defaultQueue.upsertJobScheduler(
    "scheduled:reload-tour-ocup",
    { pattern: "0 3 * * *", tz },
    {
      name: JobName.TARGETED_RELOAD,
      data: {
        name: "tour_ocup",
        search: "#tour_ocup%Y",
        nightly: true,
        updatePublic: false,
      },
    },
  );
  log.info("Registered schedule: reload-tour-ocup (daily 3:00 AM HST)");

  // BEA — 6:00 AM HST daily
  await defaultQueue.upsertJobScheduler(
    "scheduled:reload-bea",
    { pattern: "0 6 * * *", tz },
    {
      name: JobName.TARGETED_RELOAD,
      data: {
        name: "bea",
        search: "#load_api_bea",
        nightly: true,
        updatePublic: true,
        groupSize: 10,
      },
    },
  );
  log.info("Registered schedule: reload-bea (daily 6:00 AM HST)");

  // BLS — 6:00 AM HST daily
  await defaultQueue.upsertJobScheduler(
    "scheduled:reload-bls-morning",
    { pattern: "0 6 * * *", tz },
    {
      name: JobName.TARGETED_RELOAD,
      data: {
        name: "bls",
        search: "#load_api_bls",
        nightly: true,
        updatePublic: true,
      },
    },
  );
  log.info("Registered schedule: reload-bls-morning (daily 6:00 AM HST)");

  // BLS — 10:20 AM HST daily (second run)
  await defaultQueue.upsertJobScheduler(
    "scheduled:reload-bls-midday",
    { pattern: "20 10 * * *", tz },
    {
      name: JobName.TARGETED_RELOAD,
      data: {
        name: "bls",
        search: "#load_api_bls",
        nightly: true,
        updatePublic: true,
      },
    },
  );
  log.info("Registered schedule: reload-bls-midday (daily 10:20 AM HST)");

  // SA — 10:00 AM weekdays HST
  await defaultQueue.upsertJobScheduler(
    "scheduled:reload-sa",
    { pattern: "0 10 * * 1-5", tz },
    {
      name: JobName.TARGETED_RELOAD,
      data: {
        name: "sa",
        search: "#sa_jobs.csv,#sa_tour.csv",
        nightly: false,
        updatePublic: false,
      },
    },
  );
  log.info("Registered schedule: reload-sa (weekdays 10:00 AM HST)");

  // VAP HI — 4:15 PM weekdays HST
  await defaultQueue.upsertJobScheduler(
    "scheduled:reload-vap-hi",
    { pattern: "15 16 * * 1-5", tz },
    {
      name: JobName.TARGETED_RELOAD,
      data: {
        name: "vaphid",
        search: "^vap ~ns$ @hi .d",
        nightly: true,
        updatePublic: true,
      },
    },
  );
  log.info("Registered schedule: reload-vap-hi (weekdays 4:15 PM HST)");

  // UIC weekly — 11:00 AM Thursdays HST
  await defaultQueue.upsertJobScheduler(
    "scheduled:reload-uic",
    { pattern: "0 11 * * 4", tz },
    {
      name: JobName.TARGETED_RELOAD,
      data: {
        name: "uic_weekly",
        search: "#uic@hawa",
        nightly: true,
        updatePublic: true,
      },
    },
  );
  log.info("Registered schedule: reload-uic (Thursdays 11:00 AM HST)");

  // ─── Downloads ─────────────────────────────────────────────────────

  // PV_HON download — 9:15 AM HST daily
  await defaultQueue.upsertJobScheduler(
    "scheduled:download-pvhon",
    { pattern: "15 9 * * *", tz },
    {
      name: JobName.DOWNLOAD,
      data: { handle: "PV_HON@hawaii.gov" },
    },
  );
  log.info("Registered schedule: download-pvhon (daily 9:15 AM HST)");

  log.info("All schedules registered");
}
