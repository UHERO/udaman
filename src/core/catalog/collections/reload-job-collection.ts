import { createLogger } from "@/core/observability/logger";
import {
  enqueueAdminAction,
  enqueueReloadJob,
  enqueueTsdExport,
  enqueueUpdatePublic,
} from "@/core/workers/enqueue";
import { mysql, rawQuery } from "@/lib/mysql/db";

import ReloadJob from "../models/reload-job";
import type { ReloadJobAttrs } from "../models/reload-job";

const log = createLogger("catalog.reload-job-collection");

export type AdminAction =
  | "export_tsd"
  | "restart_rest"
  | "restart_dvw"
  | "clear_cache"
  | "update_public"
  | "sync_nas";

export interface EnrichedReloadJob {
  job: ReturnType<ReloadJob["toJSON"]>;
  username: string;
  seriesNames: string[];
  seriesCount: number;
}

interface ReloadJobRow extends ReloadJobAttrs {
  email: string | null;
}

interface JobSeriesRow {
  reload_job_id: number;
  series_name: string;
}

class ReloadJobCollection {
  /** Fetch recent reload jobs with user and series info */
  static async listRecent(limit = 50): Promise<EnrichedReloadJob[]> {
    const rows = await mysql<ReloadJobRow>`
      SELECT
        rj.id, rj.user_id, rj.status, rj.created_at, rj.finished_at,
        rj.params, rj.update_public, rj.error,
        u.email
      FROM reload_jobs rj
      LEFT JOIN users u ON u.id = rj.user_id
      WHERE rj.user_id > 1
      ORDER BY rj.created_at DESC
      LIMIT ${limit}
    `;

    if (rows.length === 0) return [];

    const jobIds = rows.map((r) => r.id);
    const placeholders = jobIds.map(() => "?").join(",");

    const seriesRows = await rawQuery<JobSeriesRow>(
      `SELECT rjs.reload_job_id, s.name AS series_name
       FROM reload_job_series rjs
       JOIN series s ON s.id = rjs.series_id
       WHERE rjs.reload_job_id IN (${placeholders})`,
      jobIds,
    );

    const seriesMap = new Map<number, string[]>();
    for (const sr of seriesRows) {
      const names = seriesMap.get(sr.reload_job_id) ?? [];
      names.push(sr.series_name);
      seriesMap.set(sr.reload_job_id, names);
    }

    return rows.map((row) => {
      const job = new ReloadJob(row);
      const seriesNames = seriesMap.get(row.id) ?? [];
      const email = row.email ?? "unknown";
      const username = email.includes("@") ? email.split("@")[0] : email;
      return {
        job: job.toJSON(),
        username,
        seriesNames,
        seriesCount: seriesNames.length,
      };
    });
  }

  /** Delete a reload job and its join rows */
  static async deleteJob(id: number): Promise<void> {
    await mysql`DELETE FROM reload_job_series WHERE reload_job_id = ${id}`;
    await mysql`DELETE FROM reload_jobs WHERE id = ${id}`;
    log.info({ id }, "Deleted reload job");
  }

  /** Run an admin action — dispatches to background job queue */
  static async runAdminAction(
    action: AdminAction,
  ): Promise<{ success: boolean; message: string }> {
    log.info({ action }, `Queuing admin action: ${action}`);

    switch (action) {
      case "export_tsd": {
        await enqueueTsdExport();
        return { success: true, message: "TSD export queued" };
      }
      case "update_public": {
        await enqueueUpdatePublic();
        return { success: true, message: "Public data update queued" };
      }
      case "clear_cache": {
        await enqueueAdminAction({ action: "clear_cache" });
        return { success: true, message: "Cache clear queued" };
      }
      case "restart_rest": {
        await enqueueAdminAction({ action: "restart_rest" });
        return { success: true, message: "REST API restart queued" };
      }
      case "restart_dvw": {
        await enqueueAdminAction({ action: "restart_dvw" });
        return { success: true, message: "DVW API restart queued" };
      }
      case "sync_nas": {
        await enqueueAdminAction({ action: "sync_nas" });
        return { success: true, message: "NAS file sync queued" };
      }
      default:
        return { success: false, message: `Unknown action: ${action}` };
    }
  }

  /** Delete reload jobs older than the given horizon. Ports ReloadJob.purge_old_jobs. */
  static async purgeOldJobs(horizonDays = 7): Promise<number> {
    // Delete join table rows first
    await rawQuery(
      `DELETE rjs FROM reload_job_series rjs
       JOIN reload_jobs rj ON rj.id = rjs.reload_job_id
       WHERE rj.created_at < NOW() - INTERVAL ? DAY`,
      [horizonDays],
    );
    const result = await rawQuery(
      `DELETE FROM reload_jobs WHERE created_at < NOW() - INTERVAL ? DAY`,
      [horizonDays],
    );
    const count = (result as unknown as { count?: number }).count ?? 0;
    log.info({ horizonDays, count }, "Purged old reload jobs");
    return count;
  }

  /** Delete old series_reload_logs. */
  static async purgeOldReloadLogs(horizonDays = 14): Promise<number> {
    const result = await rawQuery(
      `DELETE FROM series_reload_logs WHERE created_at < NOW() - INTERVAL ? DAY`,
      [horizonDays],
    );
    const count = (result as unknown as { count?: number }).count ?? 0;
    log.info({ horizonDays, count }, "Purged old reload logs");
    return count;
  }

  /** Delete old dsd_log_entries. */
  static async purgeOldDsdLogs(horizonDays = 42): Promise<number> {
    const result = await rawQuery(
      `DELETE FROM dsd_log_entries WHERE time < NOW() - INTERVAL ? DAY`,
      [horizonDays],
    );
    const count = (result as unknown as { count?: number }).count ?? 0;
    log.info({ horizonDays, count }, "Purged old DSD log entries");
    return count;
  }

  /**
   * Create a reload job from a search query and enqueue it.
   * Ports ReloadJobDaemon.enqueue.
   */
  static async enqueueReload(opts: {
    name: string;
    search: string;
    nightly: boolean;
    updatePublic: boolean;
  }): Promise<number | null> {
    const { name, search, nightly, updatePublic } = opts;

    // Lazy import to avoid circular
    const { default: SeriesCollection } = await import("./series-collection");

    // Handle comma-separated searches (for SA which combines two queries)
    const searches = search
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const allSeries: { id: number }[] = [];

    for (const q of searches) {
      const results = await SeriesCollection.search({
        text: q,
        universe: "UHERO",
      });
      allSeries.push(...results.map((s) => ({ id: s.id! })));
    }

    // Deduplicate
    const seriesIds = [...new Set(allSeries.map((s) => s.id))];

    if (seriesIds.length === 0) {
      log.warn({ name }, `enqueueReload: No series found for "${search}"`);
      return null;
    }

    const params = JSON.stringify([name, { nightly }]);

    try {
      await mysql`
        INSERT INTO reload_jobs (user_id, update_public, params, created_at)
        VALUES (1, ${updatePublic}, ${params}, NOW())
      `;
      const [{ insertId }] = await mysql<{ insertId: number }>`
        SELECT LAST_INSERT_ID() AS insertId
      `;

      // Insert join table rows
      for (const sid of seriesIds) {
        await mysql`
          INSERT INTO reload_job_series (reload_job_id, series_id)
          VALUES (${insertId}, ${sid})
        `;
      }

      // Enqueue the BullMQ job
      await enqueueReloadJob({ reloadJobId: insertId });

      log.info(
        { name, reloadJobId: insertId, seriesCount: seriesIds.length },
        "Reload job enqueued",
      );
      return insertId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error({ name, err: msg }, "Failed to enqueue reload job");
      return null;
    }
  }
}

export default ReloadJobCollection;
