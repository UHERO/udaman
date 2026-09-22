import { toSnakeCase } from "@/lib/mysql/helpers";
import { rawQuery } from "@/lib/mysql/hhdb";

import {
  HhdbAccessoryImprovement,
  hhdbAccessoryImprovementRowToJSON,
  type HhdbAccessoryImprovementAttrs,
} from "../models/hhdb-accessory-improvement";
import type { HhdbAccessoryImprovementJSON } from "../models/hhdb-accessory-improvement";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = ["tmk", "description", "quantity", "year_built", "area"];

export default class HhdbAccessoryImprovementCollection {
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
      where = "WHERE (tmk LIKE ? OR description LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbAccessoryImprovement>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM accessory_improvements ${where}`,
        qp,
      ),
      rawQuery<HhdbAccessoryImprovementAttrs>(
        `SELECT * FROM accessory_improvements ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbAccessoryImprovement(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbAccessoryImprovementJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM accessory_improvements ${where}`,
        qp,
      ),
      rawQuery<HhdbAccessoryImprovementAttrs>(
        `SELECT * FROM accessory_improvements ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbAccessoryImprovementRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
