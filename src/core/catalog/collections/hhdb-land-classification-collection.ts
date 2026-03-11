import { toSnakeCase } from "@/lib/mysql/helpers";
import { rawQuery } from "@/lib/mysql/hhdb";

import {
  HhdbLandClassification,
  hhdbLandClassificationRowToJSON,
  type HhdbLandClassificationAttrs,
} from "../models/hhdb-land-classification";
import type { HhdbLandClassificationJSON } from "../models/hhdb-land-classification";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "land_classification",
  "square_footage",
  "acreage",
  "agricultural_use_indicator",
];

export default class HhdbLandClassificationCollection {
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
        "WHERE (tmk LIKE ? OR land_classification LIKE ? OR agricultural_use_indicator LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbLandClassification>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM land_classifications ${where}`,
        qp,
      ),
      rawQuery<HhdbLandClassificationAttrs>(
        `SELECT * FROM land_classifications ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbLandClassification(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbLandClassificationJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM land_classifications ${where}`,
        qp,
      ),
      rawQuery<HhdbLandClassificationAttrs>(
        `SELECT * FROM land_classifications ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbLandClassificationRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
