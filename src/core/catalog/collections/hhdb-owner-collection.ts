import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbOwner, type HhdbOwnerAttrs } from "../models/hhdb-owner";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "owner_name",
  "owner_type",
  "sequence_order",
];

export default class HhdbOwnerCollection {
  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbOwner>> {
    const { page, limit, search, sort = "tmk", order = "asc" } = params;
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where =
        "WHERE (tmk LIKE ? OR owner_name LIKE ? OR owner_type LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM owners ${where}`,
        qp,
      ),
      rawQuery<HhdbOwnerAttrs>(
        `SELECT * FROM owners ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbOwner(r)),
      total: Number(countResult[0].cnt),
    };
  }
}
