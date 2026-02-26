import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbHistoricalTaxSummary, type HhdbHistoricalTaxSummaryAttrs } from "../models/hhdb-historical-tax-summary";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

export default class HhdbHistoricalTaxSummaryCollection {
  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbHistoricalTaxSummary>> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

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
}
