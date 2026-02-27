import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbHistoricalTaxSummary, type HhdbHistoricalTaxSummaryAttrs, hhdbHistoricalTaxSummaryRowToJSON } from "../models/hhdb-historical-tax-summary";
import type { HhdbHistoricalTaxSummaryJSON } from "../models/hhdb-historical-tax-summary";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

export default class HhdbHistoricalTaxSummaryCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    return { limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbHistoricalTaxSummary>> {
    const { limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>("SELECT COUNT(*) as cnt FROM historical_tax_summary", []),
      rawQuery<HhdbHistoricalTaxSummaryAttrs>(
        "SELECT * FROM historical_tax_summary ORDER BY id ASC LIMIT ? OFFSET ?",
        [limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbHistoricalTaxSummary(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(params: HhdbListParams): Promise<HhdbListResult<HhdbHistoricalTaxSummaryJSON>> {
    const { limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>("SELECT COUNT(*) as cnt FROM historical_tax_summary", []),
      rawQuery<HhdbHistoricalTaxSummaryAttrs>(
        "SELECT * FROM historical_tax_summary ORDER BY id ASC LIMIT ? OFFSET ?",
        [limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbHistoricalTaxSummaryRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
