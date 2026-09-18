import { mysql, rawQuery } from "@database/mysql";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("loader-action-collection");

export interface LoaderActionRow {
  id: number;
  loaderId: number | null;
  seriesId: number | null;
  userId: number | null;
  userEmail: string | null;
  action: string;
  priority: number | null;
  eval: string | null;
  color: string | null;
  createdAt: Date;
}

interface CreateLoaderActionPayload {
  loaderId: number;
  seriesId: number;
  userId: number | null;
  userEmail: string | null;
  action: string;
  priority: number | null;
  eval: string | null;
}

export class LoaderActionCollection {
  /** Fire-and-forget INSERT into data_source_actions. Never throws. */
  static async create(payload: CreateLoaderActionPayload): Promise<void> {
    try {
      await mysql`
        INSERT INTO data_source_actions
          (data_source_id, series_id, user_id, user_email, action, priority, eval, created_at, updated_at)
        VALUES
          (${payload.loaderId}, ${payload.seriesId}, ${payload.userId}, ${payload.userEmail},
           ${payload.action}, ${payload.priority}, ${payload.eval}, NOW(), NOW())
      `;
    } catch (e) {
      log.error({ err: e, payload }, "Failed to write data_source_action");
    }
  }

  /** Get all actions for a series, with loader color from data_sources. */
  static async getBySeriesId(seriesId: number): Promise<LoaderActionRow[]> {
    const rows = await rawQuery(
      `SELECT dsa.id, dsa.data_source_id, dsa.series_id, dsa.user_id, dsa.user_email,
              dsa.action, dsa.priority, dsa.eval, ds.color, dsa.created_at
       FROM data_source_actions dsa
       LEFT JOIN data_sources ds ON ds.id = dsa.data_source_id
       WHERE dsa.series_id = ?
       ORDER BY dsa.created_at DESC`,
      [seriesId],
    );

    return rows.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      loaderId: r.data_source_id != null ? Number(r.data_source_id) : null,
      seriesId: r.series_id != null ? Number(r.series_id) : null,
      userId: r.user_id != null ? Number(r.user_id) : null,
      userEmail: (r.user_email as string) ?? null,
      action: (r.action as string) ?? "",
      priority: r.priority != null ? Number(r.priority) : null,
      eval: (r.eval as string) ?? null,
      color: (r.color as string) ?? null,
      createdAt: new Date(r.created_at as string),
    }));
  }
}
