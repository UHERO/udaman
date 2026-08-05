import { NotFoundError } from "@/lib/errors";
import { insertAndGetId, mysql } from "@/lib/mysql/db";

import Approval from "../models/approval";
import type {
  ApprovalAttrs,
  ApprovalType,
  PreReleaseFormData,
} from "../models/approval";
import type { Universe } from "../types/shared";

export type CreateApprovalPayload = {
  type?: ApprovalType;
  universe: Universe;
  name: string;
  author: string;
  authorUserId: number;
  targetReleaseDate?: string | null;
  formData: PreReleaseFormData;
};

export type UpdateApprovalPayload = {
  name?: string;
  author?: string;
  targetReleaseDate?: string | null;
  formData?: PreReleaseFormData;
};

class ApprovalCollection {
  /**
   * List approvals for a universe, newest first.
   *
   * Soft-deleted rows are excluded. These are signed certifications, so
   * `delete` sets `deleted_at` rather than removing the record.
   */
  static async list(options: {
    universe: Universe;
    type?: ApprovalType;
  }): Promise<Approval[]> {
    const { universe, type } = options;
    const rows = type
      ? await mysql<ApprovalAttrs>`
          SELECT * FROM approvals
          WHERE universe = ${universe} AND type = ${type} AND deleted_at IS NULL
          ORDER BY created_at DESC
        `
      : await mysql<ApprovalAttrs>`
          SELECT * FROM approvals
          WHERE universe = ${universe} AND deleted_at IS NULL
          ORDER BY created_at DESC
        `;
    return rows.map((row) => new Approval(row));
  }

  /** Fetch a single approval by ID. Soft-deleted rows are treated as missing. */
  static async getById(id: number): Promise<Approval> {
    const rows = await mysql<ApprovalAttrs>`
      SELECT * FROM approvals WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError("Approval", id);
    return new Approval(row);
  }

  /** Create a new approval record. */
  static async create(payload: CreateApprovalPayload): Promise<Approval> {
    const {
      type = "pre_release",
      universe,
      name,
      author,
      authorUserId,
      targetReleaseDate = null,
      formData,
    } = payload;

    const insertId = await insertAndGetId(
      `INSERT INTO approvals
         (type, universe, name, author, author_user_id, target_release_date,
          form_data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        type,
        universe,
        name,
        author,
        authorUserId,
        targetReleaseDate || null,
        JSON.stringify(formData),
      ],
    );
    return this.getById(insertId);
  }

  /**
   * Update an approval.
   *
   * Written as a positional query rather than `buildUpdateObject` because that
   * helper passes object values straight through to the driver, which mangles
   * the `form_data` JSON column.
   */
  static async update(
    id: number,
    updates: UpdateApprovalPayload,
  ): Promise<Approval> {
    const current = await this.getById(id);

    await mysql`
      UPDATE approvals
      SET name = ${updates.name ?? current.name},
          author = ${updates.author ?? current.author},
          target_release_date = ${
            updates.targetReleaseDate !== undefined
              ? updates.targetReleaseDate || null
              : current.targetReleaseDate
          },
          form_data = ${JSON.stringify(updates.formData ?? current.formData)},
          updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /** Soft-delete: keeps the certification on file but hides it from listings. */
  static async delete(id: number): Promise<void> {
    await this.getById(id); // 404s if already gone
    await mysql`UPDATE approvals SET deleted_at = NOW() WHERE id = ${id}`;
  }
}

export default ApprovalCollection;
