import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbCommercialDetail, type HhdbCommercialDetailAttrs } from "../models/hhdb-commercial-detail";
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
  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbCommercialDetail>> {
    const { page, limit, search, sort = "tmk", order = "asc" } = params;
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where = "WHERE (tmk LIKE ? OR usage LIKE ? OR construction LIKE ? OR description LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term, term);
    }

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM commercial_improvement_details ${where}`, qp),
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
}
