import { rawQuery } from "@/lib/mysql/hhdb";

import {
  HhdbHistoricalTaxPayment,
  hhdbHistoricalTaxPaymentRowToJSON,
  type HhdbHistoricalTaxPaymentAttrs,
} from "../models/hhdb-historical-tax-payment";
import type { HhdbHistoricalTaxPaymentJSON } from "../models/hhdb-historical-tax-payment";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

export default class HhdbHistoricalTaxPaymentCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    return { limit, offset };
  }

  static async list(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbHistoricalTaxPayment>> {
    const { limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM historical_tax_payments",
        [],
      ),
      rawQuery<HhdbHistoricalTaxPaymentAttrs>(
        "SELECT * FROM historical_tax_payments ORDER BY id ASC LIMIT ? OFFSET ?",
        [limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbHistoricalTaxPayment(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbHistoricalTaxPaymentJSON>> {
    const { limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM historical_tax_payments",
        [],
      ),
      rawQuery<HhdbHistoricalTaxPaymentAttrs>(
        "SELECT * FROM historical_tax_payments ORDER BY id ASC LIMIT ? OFFSET ?",
        [limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbHistoricalTaxPaymentRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
