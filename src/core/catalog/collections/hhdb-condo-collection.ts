import { rawQuery } from "@/lib/mysql/hhdb";
import {
  HhdbCondoProject,
  HhdbCondoUnit,
  type HhdbCondoProjectAttrs,
  type HhdbCondoUnitAttrs,
} from "../models/hhdb-condo";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";

const PROJECT_SORTABLE = [
  "tmk",
  "project_name",
  "developer",
  "unit_count",
  "zoning",
  "address",
  "city",
  "project_number",
  "buildings",
  "floors",
  "final_date",
];

const UNIT_SORTABLE = [
  "id",
  "tmk",
  "parent_tmk",
  "unit_number",
  "owner_name",
];

export default class HhdbCondoCollection {
  static async listProjects(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbCondoProject>> {
    const { page, limit, search, sort = "tmk", order = "asc" } = params;
    const offset = (page - 1) * limit;
    const sortCol = PROJECT_SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where =
        "WHERE (tmk LIKE ? OR project_name LIKE ? OR developer LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM condominium_projects ${where}`,
        qp,
      ),
      rawQuery<HhdbCondoProjectAttrs>(
        `SELECT * FROM condominium_projects ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbCondoProject(r)),
      total: Number(countResult[0].cnt),
    };
  }

  static async listUnits(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbCondoUnit>> {
    const { page, limit, search, sort = "id", order = "asc" } = params;
    const offset = (page - 1) * limit;
    const sortCol = UNIT_SORTABLE.includes(sort) ? sort : "id";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where =
        "WHERE (tmk LIKE ? OR parent_tmk LIKE ? OR unit_number LIKE ? OR owner_name LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term, term);
    }

    const [countResult, rows] = await Promise.all([
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM condominium_units ${where}`,
        qp,
      ),
      rawQuery<HhdbCondoUnitAttrs>(
        `SELECT * FROM condominium_units ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...qp, limit, offset],
      ),
    ]);

    return {
      rows: rows.map((r) => new HhdbCondoUnit(r)),
      total: Number(countResult[0].cnt),
    };
  }
}
