import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbPermit, type HhdbPermitAttrs, hhdbPermitRowToJSON } from "../models/hhdb-permit";
import type { HhdbPermitJSON } from "../models/hhdb-permit";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "id",
  "tmk",
  "permit_date",
  "permit_number",
  "reason",
  "permit_amount",
];

export default class HhdbPermitCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit, search, sort = "id", order = "asc" } = params;
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "id";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where = "WHERE (tmk LIKE ? OR permit_number LIKE ? OR reason LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbPermit>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM permits ${where}`, qp),
      rawQuery<HhdbPermitAttrs>(
        `SELECT * FROM permits ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbPermit(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(params: HhdbListParams): Promise<HhdbListResult<HhdbPermitJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM permits ${where}`, qp),
      rawQuery<HhdbPermitAttrs>(
        `SELECT * FROM permits ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbPermitRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
