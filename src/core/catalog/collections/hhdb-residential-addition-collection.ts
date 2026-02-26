import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbResidentialAddition, type HhdbResidentialAdditionAttrs } from "../models/hhdb-residential-addition";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "card",
  "line",
  "area",
];

export default class HhdbResidentialAdditionCollection {
  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbResidentialAddition>> {
    const { page, limit, search, sort = "tmk", order = "asc" } = params;
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where = "WHERE (tmk LIKE ? OR card LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term);
    }

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM residential_additions ${where}`, qp),
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
}
