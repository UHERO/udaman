import { rawQuery } from "@/lib/mysql/db";

import UniverseUpload from "../models/universe-upload";
import type { UniverseUploadAttrs, UploadStatus } from "../models/universe-upload";

/** Base collection for universe upload tables (new_dbedt_uploads, etc.) */
class UniverseUploadCollection {
  protected static tableName = "new_dbedt_uploads";

  static async list(): Promise<UniverseUpload[]> {
    const rows = await rawQuery<UniverseUploadAttrs>(
      `SELECT * FROM ${this.tableName} ORDER BY upload_at DESC`,
    );
    return rows.map((row) => new UniverseUpload(row));
  }

  static async getById(id: number): Promise<UniverseUpload> {
    const rows = await rawQuery<UniverseUploadAttrs>(
      `SELECT * FROM ${this.tableName} WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new Error(`Upload not found: ${id}`);
    return new UniverseUpload(row);
  }

  static async create(filename: string): Promise<UniverseUpload> {
    await rawQuery(
      `INSERT INTO ${this.tableName} (upload_at, active, status, filename) VALUES (NOW(), 0, 'processing', ?)`,
      [filename],
    );
    const rows = await rawQuery<{ insertId: number }>(
      "SELECT LAST_INSERT_ID() as insertId",
    );
    return this.getById(rows[0].insertId);
  }

  static async updateStatus(
    id: number,
    status: UploadStatus,
    error?: string | null,
  ): Promise<void> {
    if (error) {
      await rawQuery(
        `UPDATE ${this.tableName} SET status = ?, last_error = ?, last_error_at = NOW() WHERE id = ?`,
        [status, error.slice(0, 254), id],
      );
    } else {
      await rawQuery(
        `UPDATE ${this.tableName} SET status = ?, last_error = NULL, last_error_at = NULL WHERE id = ?`,
        [status, id],
      );
    }
  }

  /** Deactivate all uploads, then activate the specified one */
  static async activate(id: number): Promise<void> {
    await rawQuery(`UPDATE ${this.tableName} SET active = 0`);
    await rawQuery(
      `UPDATE ${this.tableName} SET active = 1 WHERE id = ?`,
      [id],
    );
  }
}

class DbedtUploadCollection extends UniverseUploadCollection {
  protected static override tableName = "new_dbedt_uploads";
}

export { UniverseUploadCollection, DbedtUploadCollection };
