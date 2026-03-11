import { toSnakeCase } from "@/lib/mysql/helpers";
import { rawQuery } from "@/lib/mysql/hhdb";

import {
  HhdbCondoProject,
  hhdbCondoProjectRowToJSON,
  HhdbCondoUnit,
  hhdbCondoUnitRowToJSON,
  type HhdbCondoProjectAttrs,
  type HhdbCondoUnitAttrs,
} from "../models/hhdb-condo";
import type {
  HhdbCondoProjectJSON,
  HhdbCondoUnitJSON,
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

const UNIT_SORTABLE = ["id", "tmk", "parent_tmk", "unit_number", "owner_name"];

export default class HhdbCondoCollection {
  private static _buildProjectQuery(params: HhdbListParams) {
    const {
      page,
      limit,
      search,
      sort: rawSort = "tmk",
      order = "asc",
    } = params;
    const sort = toSnakeCase(rawSort);
    const offset = (page - 1) * limit;
    const sortCol = PROJECT_SORTABLE.includes(sort) ? sort : "tmk";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    let where = "";
    const qp: (string | number)[] = [];
    if (search) {
      where = "WHERE (tmk LIKE ? OR project_name LIKE ? OR developer LIKE ?)";
      const term = `%${search}%`;
      qp.push(term, term, term);
    }

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  private static _buildUnitQuery(params: HhdbListParams) {
    const { page, limit, search, sort: rawSort = "id", order = "asc" } = params;
    const sort = toSnakeCase(rawSort);
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

    return { where, qp, sortCol, sortDir, limit, offset };
  }

  static async listProjects(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbCondoProject>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildProjectQuery(params);

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

  static async listProjectsJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbCondoProjectJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildProjectQuery(params);

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
      rows: rows.map(hhdbCondoProjectRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }

  static async listUnits(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbCondoUnit>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildUnitQuery(params);

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

  static async listUnitsJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbCondoUnitJSON>> {
    const { where, qp, sortCol, sortDir, limit, offset } =
      this._buildUnitQuery(params);

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
      rows: rows.map(hhdbCondoUnitRowToJSON),
      total: Number(countResult[0].cnt),
    };
  }
}
