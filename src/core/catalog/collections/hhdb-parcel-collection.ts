import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbParcel, type HhdbParcelAttrs } from "../models/hhdb-parcel";
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
  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbParcel>> {
    const { page, limit, search, sort = "tmk", order = "asc" } = params;
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
}
