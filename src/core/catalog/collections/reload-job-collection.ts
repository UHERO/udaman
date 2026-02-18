import { exec } from "child_process";
import { promisify } from "util";

import { createLogger } from "@/core/observability/logger";
import { mysql, rawQuery } from "@/lib/mysql/db";

import ReloadJob from "../models/reload-job";
import type { ReloadJobAttrs } from "../models/reload-job";

const log = createLogger("catalog.reload-job-collection");
const execAsync = promisify(exec);

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

  /** Run an admin action */
  static async runAdminAction(
    action: AdminAction,
  ): Promise<{ success: boolean; message: string }> {
    log.info({ action }, `Running admin action: ${action}`);

    switch (action) {
      case "export_tsd": {
        // TODO: implement TSD export (requires porting ExportWorker)
        return { success: false, message: "TSD export not yet implemented" };
      }
      case "restart_rest": {
        try {
          await execAsync("sudo systemctl restart rest-api.service");
          return { success: true, message: "REST API restart done" };
        } catch {
          return { success: false, message: "REST API restart FAIL" };
        }
      }
      case "restart_dvw": {
        try {
          await execAsync("sudo systemctl restart dvw-api.service");
          return { success: true, message: "DVW API restart done" };
        } catch {
          return { success: false, message: "DVW API restart FAIL" };
        }
      }
      case "clear_cache": {
        try {
          await execAsync(
            'ssh uhero@uhero12.colo.hawaii.edu "bin/clear_api_cache.sh /v1"',
          );
          return { success: true, message: "API cache clear done" };
        } catch {
          return { success: false, message: "API cache clear FAIL" };
        }
      }
      case "update_public": {
        // TODO: implement update public data points (requires DataPoint porting)
        return {
          success: false,
          message: "Update public data points not yet implemented",
        };
      }
      case "sync_nas": {
        try {
          await execAsync(
            'ssh uhero@uhero13.colo.hawaii.edu "/home/uhero/filesync.sh"',
          );
          return { success: true, message: "NAS file sync done" };
        } catch {
          return { success: false, message: "NAS file sync FAIL" };
        }
      }
      default:
        return { success: false, message: `Unknown action: ${action}` };
    }
  }
}

export default ReloadJobCollection;
