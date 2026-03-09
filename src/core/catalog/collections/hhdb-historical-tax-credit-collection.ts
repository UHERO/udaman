import { rawQuery } from "@/lib/mysql/hhdb";
import { toSnakeCase } from "@/lib/mysql/helpers";
import { HhdbHistoricalTaxCredit, type HhdbHistoricalTaxCreditAttrs, hhdbHistoricalTaxCreditRowToJSON } from "../models/hhdb-historical-tax-credit";
import type { HhdbHistoricalTaxCreditJSON } from "../models/hhdb-historical-tax-credit";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "period",
  "description",
  "amount",
];

export default class HhdbHistoricalTaxCreditCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit, search, sort: rawSort = "tmk", order = "asc" } = params;
    const sort = toSnakeCase(rawSort);
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where = "WHERE (tmk LIKE ? OR period LIKE ? OR description LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbHistoricalTaxCredit>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM historical_tax_credits ${where}`, qp),
      rawQuery<HhdbHistoricalTaxCreditAttrs>(
        `SELECT * FROM historical_tax_credits ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbHistoricalTaxCredit(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(params: HhdbListParams): Promise<HhdbListResult<HhdbHistoricalTaxCreditJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM historical_tax_credits ${where}`, qp),
      rawQuery<HhdbHistoricalTaxCreditAttrs>(
        `SELECT * FROM historical_tax_credits ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbHistoricalTaxCreditRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
