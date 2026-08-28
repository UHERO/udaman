import type { Job } from "bullmq";

import { withHeavyDbLock } from "@/lib/mysql/db-lock";

import { JobName } from "../queues";
import { processAdminAction } from "./admin-action";
import { processApiDvwReload } from "./api-dvw-reload";
import { processBatchReload } from "./batch-reload";
import {
  processClipboardAction,
  processClipboardLoaderReload,
} from "./clipboard-action";
import { processDbedtUpload } from "./dbedt-upload";
import { processDependencyReset } from "./dependency-reset";
import { processDownload } from "./download";
import { processDvwUpload } from "./dvw-upload";
import { processKauaiExport } from "./kauai-export";
import { processPurgeOldStuff } from "./purge-old";
import { processQpubReparse } from "./qpub-reparse";
import { processReloadJob } from "./reload-job";
import { processSeriesReload } from "./series-reload";
import { processTargetedReload } from "./targeted-reload";
import { processTsdExport } from "./tsd-export";
import { processUniverseArchive } from "./universe-archive";
import { processUniversePurge } from "./universe-purge";
import { processUpdatePublic } from "./update-public";

type Processor = (job: Job) => Promise<string>;

/**
 * Wrap a processor so it runs under the cross-process heavy-DB advisory
 * lock (see src/lib/mysql/db-lock.ts). Jobs that bulk-write data_points /
 * public_data_points, or sweep whole universes, must not overlap — the
 * lock serializes them across both BullMQ workers and the web process.
 */
const heavy =
  (fn: Processor): Processor =>
  (job) =>
    withHeavyDbLock(`${job.name}#${job.id ?? "?"}`, () => fn(job));

/**
 * Left unlocked on purpose (short, narrow, or not on the main DB):
 * SERIES_RELOAD (single loader, one short tx), CLIPBOARD_* (interactive,
 * single series), DOWNLOAD (network + small writes), TSD/KAUAI exports
 * (reads only), ADMIN_ACTION (shell commands), PURGE_OLD (small log
 * tables), QPUB_REPARSE (housing DB, not the UHERO server workload).
 */
export const processors: Record<string, Processor> = {
  [JobName.SERIES_RELOAD]: processSeriesReload,
  [JobName.RELOAD_JOB]: heavy(processReloadJob),
  [JobName.TSD_EXPORT]: processTsdExport,
  [JobName.UPDATE_PUBLIC]: heavy(processUpdatePublic),
  [JobName.ADMIN_ACTION]: processAdminAction,
  [JobName.DBEDT_UPLOAD]: heavy(processDbedtUpload),
  [JobName.DVW_UPLOAD]: heavy(processDvwUpload),
  [JobName.API_DVW_RELOAD]: heavy(processApiDvwReload),
  [JobName.DEPENDENCY_RESET]: heavy(processDependencyReset),
  [JobName.PURGE_OLD]: processPurgeOldStuff,
  [JobName.BATCH_RELOAD]: heavy(processBatchReload),
  [JobName.TARGETED_RELOAD]: heavy(processTargetedReload),
  [JobName.RELOAD_BLS]: heavy(processTargetedReload),
  [JobName.RELOAD_BEA]: heavy(processTargetedReload),
  [JobName.RELOAD_TOUR_OCUP]: heavy(processTargetedReload),
  [JobName.RELOAD_SA]: heavy(processTargetedReload),
  [JobName.RELOAD_VAP_HI]: heavy(processTargetedReload),
  [JobName.RELOAD_UIC]: heavy(processTargetedReload),
  [JobName.DOWNLOAD]: processDownload,
  [JobName.KAUAI_EXPORT]: processKauaiExport,
  [JobName.CLIPBOARD_ACTION]: processClipboardAction,
  [JobName.CLIPBOARD_LOADER_RELOAD]: processClipboardLoaderReload,
  [JobName.UNIVERSE_ARCHIVE]: heavy(processUniverseArchive),
  [JobName.UNIVERSE_PURGE]: heavy(processUniversePurge),
  [JobName.QPUB_REPARSE]: processQpubReparse,
};
