import { rawQuery } from "@/lib/mysql/hhdb";
import { toSnakeCase } from "@/lib/mysql/helpers";
import { HhdbDedication, type HhdbDedicationAttrs, hhdbDedicationRowToJSON } from "../models/hhdb-dedication";
import type { HhdbDedicationJSON } from "../models/hhdb-dedication";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "tax_year",
  "number_of_dedications",
];

export default class HhdbDedicationCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit, search, sort: rawSort = "tmk", order = "asc" } = params;
    const sort = toSnakeCase(rawSort);
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where =
        "WHERE (tmk LIKE ? OR number_of_dedications LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbDedication>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM dedications ${where}`,
        qp,
      ),
      rawQuery<HhdbDedicationAttrs>(
        `SELECT * FROM dedications ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbDedication(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(params: HhdbListParams): Promise<HhdbListResult<HhdbDedicationJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM dedications ${where}`,
        qp,
      ),
      rawQuery<HhdbDedicationAttrs>(
        `SELECT * FROM dedications ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbDedicationRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
