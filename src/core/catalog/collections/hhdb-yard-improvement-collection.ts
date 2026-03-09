import { toSnakeCase } from "@/lib/mysql/helpers";
import { rawQuery } from "@/lib/mysql/hhdb";

import {
  HhdbYardImprovement,
  hhdbYardImprovementRowToJSON,
  type HhdbYardImprovementAttrs,
} from "../models/hhdb-yard-improvement";
import type { HhdbYardImprovementJSON } from "../models/hhdb-yard-improvement";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = ["tmk", "description", "quantity", "year_built", "area"];

export default class HhdbYardImprovementCollection {
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
  ): Promise<HhdbListResult<HhdbYardImprovement>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM yard_improvements ${where}`,
        qp,
      ),
      rawQuery<HhdbYardImprovementAttrs>(
        `SELECT * FROM yard_improvements ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbYardImprovement(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbYardImprovementJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM yard_improvements ${where}`,
        qp,
      ),
      rawQuery<HhdbYardImprovementAttrs>(
        `SELECT * FROM yard_improvements ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbYardImprovementRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
