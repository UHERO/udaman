import { toSnakeCase } from "@/lib/mysql/helpers";
import { rawQuery } from "@/lib/mysql/hhdb";

import {
  HhdbCommercialDetail,
  hhdbCommercialDetailRowToJSON,
  type HhdbCommercialDetailAttrs,
} from "../models/hhdb-commercial-detail";
import type { HhdbCommercialDetailJSON } from "../models/hhdb-commercial-detail";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "card",
  "section",
  "floor",
  "usage",
  "construction",
  "occupancy",
  "exterior_wall",
  "condo_style",
  "condo_type",
];

export default class HhdbCommercialDetailCollection {
  private static _buildQuery(params: HhdbListParams) {
    const {
      page,
      limit,
      search,
      sort: rawSort = "tmk",
      order = "asc",
    } = params;
    const sort = toSnakeCase(rawSort);
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where =
        "WHERE (tmk LIKE ? OR usage LIKE ? OR construction LIKE ? OR description LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbCommercialDetail>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM commercial_improvement_details ${where}`,
        qp,
      ),
      rawQuery<HhdbCommercialDetailAttrs>(
        `SELECT * FROM commercial_improvement_details ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbCommercialDetail(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbCommercialDetailJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM commercial_improvement_details ${where}`,
        qp,
      ),
      rawQuery<HhdbCommercialDetailAttrs>(
        `SELECT * FROM commercial_improvement_details ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbCommercialDetailRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
