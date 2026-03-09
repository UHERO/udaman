import { rawQuery } from "@/lib/mysql/hhdb";
import { toSnakeCase } from "@/lib/mysql/helpers";
import { HhdbAccessoryStructure, type HhdbAccessoryStructureAttrs, hhdbAccessoryStructureRowToJSON } from "../models/hhdb-accessory-structure";
import type { HhdbAccessoryStructureJSON } from "../models/hhdb-accessory-structure";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "building_number",
  "description",
  "percent_complete",
  "value",
  "year_built",
];

export default class HhdbAccessoryStructureCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit, search, sort: rawSort = "tmk", order = "asc" } = params;
    const sort = toSnakeCase(rawSort);
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where = "WHERE (tmk LIKE ? OR building_number LIKE ? OR description LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbAccessoryStructure>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM accessory_structures ${where}`, qp),
      rawQuery<HhdbAccessoryStructureAttrs>(
        `SELECT * FROM accessory_structures ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbAccessoryStructure(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(params: HhdbListParams): Promise<HhdbListResult<HhdbAccessoryStructureJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM accessory_structures ${where}`, qp),
      rawQuery<HhdbAccessoryStructureAttrs>(
        `SELECT * FROM accessory_structures ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbAccessoryStructureRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
