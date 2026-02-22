import "server-only";

/*************************************************************************
 * INVESTIGATIONS Controller
 * For troubleshooting data issues within the app, often related to
 * series load statements.
 *************************************************************************/

import LoaderCollection from "@catalog/collections/loader-collection";
import ReloadJobCollection from "@catalog/collections/reload-job-collection";
import type {
  AdminAction,
  EnrichedReloadJob,
} from "@catalog/collections/reload-job-collection";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("catalog.investigations");

export async function getLoadErrors(): Promise<
  Array<{ lastError: string; seriesId: number; count: number }>
> {
  log.info("fetching load error summary");
  const errors = await LoaderCollection.getLoadErrorSummary();
  log.info({ count: errors.length }, "load error summary fetched");
  return errors;
}

export async function getReloadJobs(): Promise<EnrichedReloadJob[]> {
  log.info("fetching recent reload jobs");
  const jobs = await ReloadJobCollection.listRecent();
  log.info({ count: jobs.length }, "reload jobs fetched");
  return jobs;
}

export async function deleteReloadJob({
  id,
}: {
  id: number;
}): Promise<{ message: string }> {
  log.info({ id }, "deleting reload job");
  await ReloadJobCollection.deleteJob(id);
  log.info({ id }, "reload job deleted");
  return { message: "Reload job deleted" };
}

export async function runAdminAction({
  action,
}: {
  action: AdminAction;
}): Promise<{ success: boolean; message: string }> {
  log.info({ action }, "running admin action");
  const result = await ReloadJobCollection.runAdminAction(action);
  log.info({ action, success: result.success }, "admin action completed");
  return result;
}
