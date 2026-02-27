import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbAppeal, type HhdbAppealAttrs, hhdbAppealRowToJSON } from "../models/hhdb-appeal";
import type { HhdbAppealJSON } from "../models/hhdb-appeal";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "year",
  "status",
  "final_value",
  "appeal_type_value",
  "tax_payer_opinion_of_property_class",
];

export default class HhdbAppealCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit, search, sort = "tmk", order = "asc" } = params;
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where =
        "WHERE (tmk LIKE ? OR status LIKE ? OR appeal_type_value LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbAppeal>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM appeals ${where}`,
        qp,
      ),
      rawQuery<HhdbAppealAttrs>(
        `SELECT * FROM appeals ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbAppeal(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(params: HhdbListParams): Promise<HhdbListResult<HhdbAppealJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM appeals ${where}`,
        qp,
      ),
      rawQuery<HhdbAppealAttrs>(
        `SELECT * FROM appeals ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbAppealRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
