import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbHistoricalTaxDetail, type HhdbHistoricalTaxDetailAttrs } from "../models/hhdb-historical-tax-detail";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

export default class HhdbHistoricalTaxDetailCollection {
  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbHistoricalTaxDetail>> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>("SELECT COUNT(*) as cnt FROM historical_tax_details", []),
      rawQuery<HhdbHistoricalTaxDetailAttrs>(
        "SELECT * FROM historical_tax_details ORDER BY id ASC LIMIT ? OFFSET ?",
        [limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbHistoricalTaxDetail(r)),
      total: Number(countResult[0].cnt),
    };
  }
}
