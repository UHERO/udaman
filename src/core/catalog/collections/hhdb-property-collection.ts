import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbProperty, type HhdbPropertyAttrs, hhdbPropertyRowToJSON } from "../models/hhdb-property";
import type { HhdbPropertyJSON } from "../models/hhdb-property";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const SORTABLE = [
  "tmk",
  "island_code",
  "parcel_number",
  "location_address",
  "property_class",
  "zoning",
  "zip",
  "project_name",
  "land_area_sqft",
  "land_area_acres",
  "neighborhood_code",
  "living_units",
  "damage",
  "reentry_zone",
  "zone_color",
  "non_taxable_status",
  "latitude",
  "longitude",
];

export default class HhdbPropertyCollection {
  private static _buildQuery(params: HhdbListParams) {
    const { page, limit, search, sort = "tmk", order = "asc" } = params;
    const offset = (page - 1) * limit;
    const sortCol = SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where =
        "WHERE (tmk LIKE ? OR location_address LIKE ? OR property_class LIKE ? OR zoning LIKE ? OR zip LIKE ? OR project_name LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term, term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbProperty>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM properties ${where}`,
        qp,
      ),
      rawQuery<HhdbPropertyAttrs>(
        `SELECT * FROM properties ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbProperty(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listJSON(params: HhdbListParams): Promise<HhdbListResult<HhdbPropertyJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } = this._buildQuery(params);

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM properties ${where}`,
        qp,
      ),
      rawQuery<HhdbPropertyAttrs>(
        `SELECT * FROM properties ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map(hhdbPropertyRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
