import type { Job } from "bullmq";

import { JobName } from "../queues";
import { processAdminAction } from "./admin-action";
import { processApiDvwReload } from "./api-dvw-reload";
import { processBatchReload } from "./batch-reload";
import { processDbedtUpload } from "./dbedt-upload";
import { processDependencyReset } from "./dependency-reset";
import { processDownload } from "./download";
import { processDvwUpload } from "./dvw-upload";
import { processKauaiExport } from "./kauai-export";
import { processPurgeOldStuff } from "./purge-old";
import { processReloadJob } from "./reload-job";
import { processSeriesReload } from "./series-reload";
import { processTargetedReload } from "./targeted-reload";
import { processTsdExport } from "./tsd-export";
import { processUpdatePublic } from "./update-public";

export const processors: Record<string, (job: Job) => Promise<string>> = {
  [JobName.SERIES_RELOAD]: processSeriesReload,
  [JobName.RELOAD_JOB]: processReloadJob,
  [JobName.TSD_EXPORT]: processTsdExport,
  [JobName.UPDATE_PUBLIC]: processUpdatePublic,
  [JobName.ADMIN_ACTION]: processAdminAction,
  [JobName.DBEDT_UPLOAD]: processDbedtUpload,
  [JobName.DVW_UPLOAD]: processDvwUpload,
  [JobName.API_DVW_RELOAD]: processApiDvwReload,
  [JobName.DEPENDENCY_RESET]: processDependencyReset,
  [JobName.PURGE_OLD]: processPurgeOldStuff,
  [JobName.BATCH_RELOAD]: processBatchReload,
  [JobName.TARGETED_RELOAD]: processTargetedReload,
  [JobName.DOWNLOAD]: processDownload,
  [JobName.KAUAI_EXPORT]: processKauaiExport,
};
