import {
  DbedtUploadCollection,
  DvwUploadCollection,
  type UniverseUploadCollection,
} from "@catalog/collections/universe-upload-collection";

import { createLogger } from "@/core/observability/logger";

import { criticalQueue, JobName } from "./queues";

const log = createLogger("worker.upload-status");

/**
 * Keep the upload tables (what the UI polls) in sync with what the worker
 * actually knows about upload jobs.
 *
 * `executeUpload` stamps the row `fail` when the load throws — but if the
 * throw *is* the database going away (2026-08-27: MariaDB OOM-killed
 * mid-upload), that stamp fails too and the row sits on "processing" until
 * the 4-hour stale sweep. Two backstops:
 *
 *  - `stampUploadFailed`: called from the BullMQ `failed` event, retries the
 *    stamp with backoff so it lands once the DB is back (systemd restarts
 *    MariaDB in ~10 s).
 *  - `reconcileProcessingUploads`: called at worker startup, marks any row
 *    still "processing" whose job is failed or gone — covers the worker
 *    itself crashing or being restarted mid-job.
 */

const STAMP_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000, 120_000];

type UploadJobName = typeof JobName.DVW_UPLOAD | typeof JobName.DBEDT_UPLOAD;

const UPLOAD_JOBS: Record<
  UploadJobName,
  { collection: typeof UniverseUploadCollection; jobIdPrefix: string }
> = {
  [JobName.DVW_UPLOAD]: {
    collection: DvwUploadCollection,
    jobIdPrefix: "dvw-upload-",
  },
  [JobName.DBEDT_UPLOAD]: {
    collection: DbedtUploadCollection,
    jobIdPrefix: "dbedt-upload-",
  },
};

/** BullMQ states in which the job is still going to run (or is running). */
const PENDING_STATES = new Set([
  "waiting",
  "active",
  "delayed",
  "prioritized",
  "waiting-children",
]);

export function isUploadJob(name: string): name is UploadJobName {
  return name in UPLOAD_JOBS;
}

/** Stamp an upload row as failed, retrying while the DB is unreachable. */
export async function stampUploadFailed(
  jobName: UploadJobName,
  uploadId: number,
  reason: string,
): Promise<void> {
  const { collection } = UPLOAD_JOBS[jobName];
  const message = `Worker: ${reason}`;

  for (let attempt = 0; ; attempt++) {
    try {
      await collection.updateStatus(uploadId, "fail", message);
      if (attempt > 0) {
        log.info({ jobName, uploadId, attempt }, "Upload row stamped failed");
      }
      return;
    } catch (e) {
      const delay = STAMP_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        log.error(
          { jobName, uploadId, err: String(e) },
          "Giving up stamping upload row failed; stale sweep will catch it",
        );
        return;
      }
      log.warn(
        { jobName, uploadId, attempt, retryInMs: delay, err: String(e) },
        "Could not stamp upload row failed; retrying",
      );
      await Bun.sleep(delay);
    }
  }
}

/**
 * At worker startup: any upload row still "processing" whose BullMQ job is
 * failed, or no longer exists, is stamped failed. Rows whose job is still
 * pending are left alone — the worker is about to run them.
 */
export async function reconcileProcessingUploads(): Promise<void> {
  for (const [name, { collection, jobIdPrefix }] of Object.entries(
    UPLOAD_JOBS,
  ) as [UploadJobName, (typeof UPLOAD_JOBS)[UploadJobName]][]) {
    let ids: number[];
    try {
      ids = await collection.listProcessingIds();
    } catch (e) {
      log.warn({ jobName: name, err: String(e) }, "Reconcile: DB unavailable");
      continue;
    }

    for (const uploadId of ids) {
      const job = await criticalQueue.getJob(`${jobIdPrefix}${uploadId}`);
      const state = job ? await job.getState() : "missing";

      if (PENDING_STATES.has(state)) continue;

      let reason: string;
      if (state === "completed") {
        // Load finished but the ok-stamp was lost; safest honest label.
        reason =
          "job completed but status was never recorded — verify data and re-upload if needed";
      } else if (state === "failed") {
        reason = job?.failedReason ?? "job failed";
      } else {
        reason = "job not found after worker restart";
      }
      log.warn(
        { jobName: name, uploadId, state },
        "Reconcile: stamping upload row failed",
      );
      await stampUploadFailed(name, uploadId, reason);
    }
  }
}
