import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbAssessment, type HhdbAssessmentAttrs, hhdbAssessmentRowToJSON } from "../models/hhdb-assessment";
import type { HhdbAssessmentJSON } from "../models/hhdb-assessment";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "id",
  "tmk",
  "tax_year",
  "property_class",
  "assessed_land_value",
  "assessed_building_value",
  "total_property_assessed_value",
  "total_property_exemption",
  "total_net_taxable_value",
  "total_market_value",
];

export default class HhdbAssessmentCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit, search, sort = "id", order = "asc" } = params;
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "id";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where = "WHERE (tmk LIKE ? OR property_class LIKE ? OR CAST(tax_year AS CHAR) LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbAssessment>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM assessments ${where}`, qp),
      rawQuery<HhdbAssessmentAttrs>(
        `SELECT * FROM assessments ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbAssessment(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(params: HhdbListParams): Promise<HhdbListResult<HhdbAssessmentJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM assessments ${where}`, qp),
      rawQuery<HhdbAssessmentAttrs>(
        `SELECT * FROM assessments ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbAssessmentRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
