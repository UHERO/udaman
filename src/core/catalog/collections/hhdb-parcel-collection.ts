import { rawQuery } from "@/lib/mysql/hhdb";
import { toSnakeCase } from "@/lib/mysql/helpers";
import { HhdbParcel, type HhdbParcelAttrs, hhdbParcelRowToJSON } from "../models/hhdb-parcel";
import type { HhdbParcelJSON } from "../models/hhdb-parcel";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "parcel_number",
  "location_address",
  "property_class",
  "zoning",
  "land_area_sqft",
  "neighborhood_code",
  "living_units",
  "project_name",
];

export default class HhdbParcelCollection {
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
        "WHERE (tmk LIKE ? OR location_address LIKE ? OR property_class LIKE ? OR zoning LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbParcel>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM parcels ${where}`,
        qp,
      ),
      rawQuery<HhdbParcelAttrs>(
        `SELECT * FROM parcels ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbParcel(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(params: HhdbListParams): Promise<HhdbListResult<HhdbParcelJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM parcels ${where}`,
        qp,
      ),
      rawQuery<HhdbParcelAttrs>(
        `SELECT * FROM parcels ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbParcelRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
