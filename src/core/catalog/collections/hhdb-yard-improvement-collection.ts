import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbYardImprovement, type HhdbYardImprovementAttrs } from "../models/hhdb-yard-improvement";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "description",
  "quantity",
  "year_built",
  "area",
];

export default class HhdbYardImprovementCollection {
  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbYardImprovement>> {
    const { page, limit, search, sort = "tmk", order = "asc" } = params;
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

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM yard_improvements ${where}`, qp),
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
}
