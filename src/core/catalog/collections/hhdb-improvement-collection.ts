import { toSnakeCase } from "@/lib/mysql/helpers";
import { rawQuery } from "@/lib/mysql/hhdb";

import {
  HhdbImprovement,
  hhdbImprovementRowToJSON,
  type HhdbImprovementAttrs,
} from "../models/hhdb-improvement";
import type { HhdbImprovementJSON } from "../models/hhdb-improvement";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const RESIDENTIAL_SORTABLE = [
  "id",
  "tmk",
  "building_number",
  "year_built",
  "eff_year_built",
  "living_area",
  "bedrooms",
  "occupancy",
  "framing",
  "grade",
  "building_value",
];

const COMMERCIAL_SORTABLE = [
  "id",
  "tmk",
  "building_number",
  "year_built",
  "improvement_name",
  "property_class",
  "structure_type",
  "units",
  "building_square_footage",
  "value",
];

const TABLE_MAP = {
  residential: "residential_improvements",
  commercial: "commercial_improvements",
} as const;

export default class HhdbImprovementCollection {
  private static _buildQuery(
    params: HhdbListParams,
    type: "residential" | "commercial" = "residential",
  ) {
    const { page, limit, search, sort: rawSort = "id", order = "asc" } = params;
    const sort = toSnakeCase(rawSort);
    const offset = (page - 1) * limit;
    const sortable =
      type === "residential" ? RESIDENTIAL_SORTABLE : COMMERCIAL_SORTABLE;
    const sortCol = sortable.includes(sort) ? sort : "id";
    const sortDir = order === "desc" ? "DESC" : "ASC";
    const table = TABLE_MAP[type];

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      if (type === "residential") {
        where =
          "WHERE (tmk LIKE ? OR occupancy LIKE ? OR framing LIKE ? OR grade LIKE ?)";
      } else {
        where =
          "WHERE (tmk LIKE ? OR improvement_name LIKE ? OR property_class LIKE ? OR structure_type LIKE ?)";
      }
      const term = `%${search}%`;
      qp.push(term, term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset, table };
  }

  static async list(
    params: HhdbListParams,
    type: "residential" | "commercial" = "residential",
  ): Promise<HhdbListResult<HhdbImprovement>> {
    const { where, qp, sortCol, sortDir, limit, offset, table } =
      this._buildQuery(params, type);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${table} ${where}`,
        qp,
      ),
      rawQuery<HhdbImprovementAttrs>(
        `SELECT * FROM ${table} ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbImprovement(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(
    params: HhdbListParams,
    type: "residential" | "commercial" = "residential",
  ): Promise<HhdbListResult<HhdbImprovementJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset, table } =
      this._buildQuery(params, type);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${table} ${where}`,
        qp,
      ),
      rawQuery<HhdbImprovementAttrs>(
        `SELECT * FROM ${table} ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbImprovementRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
