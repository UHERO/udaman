import { rawQuery } from "@/lib/mysql/hhdb";
import { toSnakeCase } from "@/lib/mysql/helpers";
import { HhdbCurrentTaxBill, type HhdbCurrentTaxBillAttrs, hhdbCurrentTaxBillRowToJSON } from "../models/hhdb-current-tax-bill";
import type { HhdbCurrentTaxBillJSON } from "../models/hhdb-current-tax-bill";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "tax_period",
  "description",
  "original_due_date",
  "taxes_assessment",
  "net_tax",
  "amount_due",
];

export default class HhdbCurrentTaxBillCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit, search, sort: rawSort = "tmk", order = "asc" } = params;
    const sort = toSnakeCase(rawSort);
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where = "WHERE (tmk LIKE ? OR tax_period LIKE ? OR description LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbCurrentTaxBill>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM current_tax_bills ${where}`, qp),
      rawQuery<HhdbCurrentTaxBillAttrs>(
        `SELECT * FROM current_tax_bills ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbCurrentTaxBill(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(params: HhdbListParams): Promise<HhdbListResult<HhdbCurrentTaxBillJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM current_tax_bills ${where}`, qp),
      rawQuery<HhdbCurrentTaxBillAttrs>(
        `SELECT * FROM current_tax_bills ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbCurrentTaxBillRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
