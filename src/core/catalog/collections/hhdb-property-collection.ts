import { rawQuery } from "@/lib/mysql/hhdb";
import { HhdbProperty, type HhdbPropertyAttrs } from "../models/hhdb-property";
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
  "neighborhood_code",
  "living_units",
];

export default class HhdbPropertyCollection {
  static async list(params: HhdbListParams): Promise<HhdbListResult<HhdbProperty>> {
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
}
