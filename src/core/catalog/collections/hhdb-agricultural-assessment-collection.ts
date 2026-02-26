import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbAgriculturalAssessment, type HhdbAgriculturalAssessmentAttrs } from "../models/hhdb-agricultural-assessment";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "agricultural_type",
  "use_description",
  "acres",
  "agricultural_value",
  "assessed_value",
];

export default class HhdbAgriculturalAssessmentCollection {
  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbAgriculturalAssessment>> {
    const { page, limit, search, sort = "tmk", order = "asc" } = params;
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where = "WHERE (tmk LIKE ? OR agricultural_type LIKE ? OR use_description LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM agricultural_assessments ${where}`, qp),
      rawQuery<HhdbAgriculturalAssessmentAttrs>(
        `SELECT * FROM agricultural_assessments ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbAgriculturalAssessment(r)),
      total: Number(countResult[0].cnt),
    };
  }
}
