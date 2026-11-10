import { toSnakeCase } from "@/lib/mysql/helpers";
import { rawQuery } from "@/lib/mysql/hhdb";

import {
  HhdbResidentialAddition,
  hhdbResidentialAdditionRowToJSON,
  type HhdbResidentialAdditionAttrs,
} from "../models/hhdb-residential-addition";
import type { HhdbResidentialAdditionJSON } from "../models/hhdb-residential-addition";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";
import { buildSearchWhere } from "../types/hhdb-search";

const SORTABLE = ["tmk", "card", "line", "area"];

export default class HhdbResidentialAdditionCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit, sort: rawSort = "tmk", order = "asc" } = params;
    const sort = toSnakeCase(rawSort);
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    const found = buildSearchWhere("residential-additions", params);
    where = found.where;
    qp.push(...found.params);

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbResidentialAddition>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM residential_additions ${where}`,
        qp,
      ),
      rawQuery<HhdbResidentialAdditionAttrs>(
        `SELECT * FROM residential_additions ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbResidentialAddition(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbResidentialAdditionJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM residential_additions ${where}`,
        qp,
      ),
      rawQuery<HhdbResidentialAdditionAttrs>(
        `SELECT * FROM residential_additions ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbResidentialAdditionRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
