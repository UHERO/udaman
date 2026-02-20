import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import ForecastSnapshot from "../models/forecast-snapshot";
import type { ForecastSnapshotAttrs } from "../models/forecast-snapshot";

export type CreateForecastSnapshotPayload = {
  name: string;
  version: string;
  published?: boolean;
  comments?: string | null;
  newForecastTsdFilename?: string | null;
  newForecastTsdLabel?: string | null;
  oldForecastTsdFilename?: string | null;
  oldForecastTsdLabel?: string | null;
  historyTsdFilename?: string | null;
  historyTsdLabel?: string | null;
};

export type UpdateForecastSnapshotPayload = Partial<CreateForecastSnapshotPayload>;

class ForecastSnapshotCollection {
  static async list(): Promise<ForecastSnapshot[]> {
    const rows = await mysql<ForecastSnapshotAttrs>`
      SELECT * FROM forecast_snapshots ORDER BY updated_at DESC
    `;
    return rows.map((row) => new ForecastSnapshot(row));
  }

  static async getById(id: number): Promise<ForecastSnapshot> {
    const rows = await mysql<ForecastSnapshotAttrs>`
      SELECT * FROM forecast_snapshots WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`ForecastSnapshot not found: ${id}`);
    return new ForecastSnapshot(row);
  }

  static async create(
    payload: CreateForecastSnapshotPayload,
  ): Promise<ForecastSnapshot> {
    await mysql`
      INSERT INTO forecast_snapshots (
        name, version, published, comments,
        new_forecast_tsd_filename, new_forecast_tsd_label,
        old_forecast_tsd_filename, old_forecast_tsd_label,
        history_tsd_filename, history_tsd_label,
        created_at, updated_at
      ) VALUES (
        ${payload.name},
        ${payload.version},
        ${payload.published ? 1 : 0},
        ${payload.comments ?? null},
        ${payload.newForecastTsdFilename ?? null},
        ${payload.newForecastTsdLabel ?? null},
        ${payload.oldForecastTsdFilename ?? null},
        ${payload.oldForecastTsdLabel ?? null},
        ${payload.historyTsdFilename ?? null},
        ${payload.historyTsdLabel ?? null},
        NOW(), NOW()
      )
    `;

    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  static async update(
    id: number,
    updates: UpdateForecastSnapshotPayload,
  ): Promise<ForecastSnapshot> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE forecast_snapshots
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  static async delete(id: number): Promise<void> {
    await mysql`DELETE FROM forecast_snapshots WHERE id = ${id}`;
  }

  /** Find all versions for a given snapshot name matching a version prefix (e.g. "1.") */
  static async findVersions(
    name: string,
    versionPrefix: string,
  ): Promise<string[]> {
    const pattern = `${versionPrefix}.%`;
    const rows = await mysql<{ version: string }>`
      SELECT version FROM forecast_snapshots
      WHERE name = ${name} AND version LIKE ${pattern}
    `;
    return rows.map((r) => r.version ?? "");
  }
}

export default ForecastSnapshotCollection;
