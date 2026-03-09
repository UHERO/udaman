import { toSnakeCase } from "@/lib/mysql/helpers";
import { rawQuery } from "@/lib/mysql/hhdb";

import {
  HhdbSale,
  hhdbSaleRowToJSON,
  type HhdbSaleAttrs,
} from "../models/hhdb-sale";
import type { HhdbSaleJSON } from "../models/hhdb-sale";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "id",
  "tmk",
  "sale_date",
  "sale_amount",
  "instrument",
  "instrument_type",
  "instrument_description",
  "valid_sale",
  "date_of_recording",
  "conveyance_tax",
  "document_type",
];

export default class HhdbSaleCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit, search, sort: rawSort = "id", order = "asc" } = params;
    const sort = toSnakeCase(rawSort);
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "id";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where =
        "WHERE (tmk LIKE ? OR instrument LIKE ? OR instrument_type LIKE ? OR instrument_description LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbSale>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM sales ${where}`,
        qp,
      ),
      rawQuery<HhdbSaleAttrs>(
        `SELECT * FROM sales ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbSale(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbSaleJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM sales ${where}`,
        qp,
      ),
      rawQuery<HhdbSaleAttrs>(
        `SELECT * FROM sales ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbSaleRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
