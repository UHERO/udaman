import ClipboardCollection from "@catalog/collections/clipboard-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";
import { mysql, rawQuery } from "@/lib/mysql/db";

import type { ClipboardActionJobData } from "../queues";

const log = createLogger("worker.clipboard-action");

export async function processClipboardAction(
  job: Job<ClipboardActionJobData>,
): Promise<string> {
  const { reloadJobId, action, seriesIds } = job.data;

  // Mark as processing
  await mysql`UPDATE reload_jobs SET status = 'processing' WHERE id = ${reloadJobId}`;

  try {
    job.log(`Executing "${action}" on ${seriesIds.length} series`);
    log.info(
      { reloadJobId, action, seriesCount: seriesIds.length },
      "Processing clipboard action",
    );

    let result: string;

    switch (action) {
      case "reload": {
        let succeeded = 0;
        let failed = 0;
        for (const seriesId of seriesIds) {
          try {
            const loaders = await LoaderCollection.getBySeriesId(seriesId);
            for (const loader of loaders) {
              await LoaderCollection.reload({ loader, clearFirst: false });
            }
            succeeded++;
            job.log(`Reloaded series ${seriesId}`);
          } catch (e) {
            failed++;
            const msg = e instanceof Error ? e.message : String(e);
            log.warn(
              { seriesId, err: msg },
              "Series reload failed, continuing",
            );
            job.log(`Series ${seriesId} failed: ${msg}`);
          }
        }
        result = `Reloaded ${succeeded} series (${failed} failed)`;
        break;
      }

      case "reset": {
        let resetCount = 0;
        for (const sid of seriesIds) {
          try {
            const loaders = await LoaderCollection.getBySeriesId(sid);
            for (const loader of loaders) {
              await LoaderCollection.reset(loader.id!);
              resetCount++;
            }
            job.log(`Reset loaders for series ${sid}`);
          } catch (e) {
            log.warn(
              { id: sid, error: e instanceof Error ? e.message : String(e) },
              "reset failed for series loader",
            );
            job.log(
              `Series ${sid} reset failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
        result = `Reset ${resetCount} loaders across ${seriesIds.length} series`;
        break;
      }

      case "clear_data": {
        let cleared = 0;
        for (const sid of seriesIds) {
          try {
            const series = await SeriesCollection.getById(sid);
            if (series.xseriesId) {
              await SeriesCollection.deleteAllDataPoints({
                id: series.xseriesId,
                u: series.universe,
              });
            }
            cleared++;
            job.log(`Cleared data for series ${sid}`);
          } catch (e) {
            log.warn(
              { id: sid, error: e instanceof Error ? e.message : String(e) },
              "clear data failed for series",
            );
            job.log(
              `Series ${sid} clear failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
        result = `Cleared data points for ${cleared} of ${seriesIds.length} series`;
        break;
      }

      case "restrict":
      case "unrestrict": {
        const restricted = action === "restrict";
        const label = restricted ? "Restricted" : "Unrestricted";
        let updated = 0;
        for (const id of seriesIds) {
          try {
            await SeriesCollection.update(id, { restricted });
            updated++;
            job.log(`${label} series ${id}`);
          } catch (e) {
            log.warn(
              { id, error: e instanceof Error ? e.message : String(e) },
              `${action} failed for series`,
            );
            job.log(
              `Series ${id} ${action} failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
        result = `${label} ${updated} of ${seriesIds.length} series`;
        break;
      }

      case "destroy": {
        const failed: number[] = [];
        // First pass
        for (const sid of seriesIds) {
          try {
            await SeriesCollection.delete(sid);
            job.log(`Destroyed series ${sid}`);
          } catch {
            failed.push(sid);
          }
        }
        // Second pass for failures (dependency ordering may resolve after first pass)
        const stillFailed: number[] = [];
        for (const sid of failed) {
          try {
            await SeriesCollection.delete(sid);
            job.log(`Destroyed series ${sid} (second pass)`);
          } catch (e) {
            stillFailed.push(sid);
            log.warn(
              { id: sid, error: e instanceof Error ? e.message : String(e) },
              "destroy failed for series on second pass",
            );
            job.log(
              `Series ${sid} destroy failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
        // Find the userId from the reload_jobs record to clear clipboard
        const [jobRow] = await mysql<{ user_id: number }>`
          SELECT user_id FROM reload_jobs WHERE id = ${reloadJobId}
        `;
        if (jobRow?.user_id) {
          await ClipboardCollection.clear(jobRow.user_id);
        }
        const destroyed = seriesIds.length - stillFailed.length;
        result =
          stillFailed.length > 0
            ? `Destroyed ${destroyed} of ${seriesIds.length} series (${stillFailed.length} failed)`
            : `Destroyed ${destroyed} series`;
        break;
      }

      default:
        result = `Unknown clipboard action: ${action}`;
    }

    // Mark as done
    await rawQuery(
      "UPDATE reload_jobs SET status = 'done', finished_at = NOW() WHERE id = ?",
      [reloadJobId],
    );
    log.info({ reloadJobId, action }, "Clipboard action completed");
    return result;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await rawQuery(
      "UPDATE reload_jobs SET status = 'fail', finished_at = NOW(), error = ? WHERE id = ?",
      [errMsg.slice(0, 254), reloadJobId],
    );
    log.error({ reloadJobId, action, err: errMsg }, "Clipboard action failed");
    throw e;
  }
}
