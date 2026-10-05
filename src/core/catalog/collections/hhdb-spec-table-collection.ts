import { rawQuery } from "@/lib/mysql/hhdb";

import {
  serializeCell,
  type SpecTableDef,
  type SpecTableRow,
} from "../models/hhdb-spec-table";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";
import { isMissingTableError } from "../utils/hhdb-missing-table";

const q = (column: string) => `\`${column}\``;

/**
 * Pure SQL builder, exported for tests. Every identifier comes from the
 * definition (code), never the request: sort falls back to defaultSort when
 * not whitelisted, and search is one prefix LIKE on one indexed column.
 */
export function buildSpecTableListSql(
  def: SpecTableDef,
  params: HhdbListParams,
) {
  const { page, limit, search, sort, order = "desc" } = params;
  const offset = (page - 1) * limit;
  const sortCol = sort && def.sortable.includes(sort) ? sort : def.defaultSort;
  const sortDir = order === "asc" ? "ASC" : "DESC";

  let where = "";
  const qp: (string | number)[] = [];
  const term = search?.trim();
  if (term) {
    where = ` WHERE ${q(def.searchColumn(term))} LIKE ?`;
    // LIKE wildcards in the term are literal.
    qp.push(`${term.replace(/[\\%_]/g, "\\$&")}%`);
  }

  // InnoDB secondary indexes are ordered (col, PK), so `col, key` is served
  // from the index and keeps pagination stable across equal values.
  const orderBy =
    sortCol === def.key
      ? `${q(def.key)} ${sortDir}`
      : `${q(sortCol)} ${sortDir}, ${q(def.key)} ${sortDir}`;
  const select = def.columns.map((c) => q(c.column)).join(", ");
  const table = q(def.table);

  return {
    countSql: `SELECT COUNT(*) AS cnt FROM ${table}${where}`,
    countParams: qp,
    rowsSql: `SELECT ${select} FROM ${table}${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    rowsParams: [...qp, limit, offset],
  };
}

/** One DB row → JSON, by each column's display kind. */
export function serializeRow(
  def: SpecTableDef,
  row: Record<string, unknown>,
): SpecTableRow {
  const out: SpecTableRow = {};
  for (const c of def.columns)
    out[c.column] = serializeCell(c.display, row[c.column]);
  return out;
}

export default class HhdbSpecTableCollection {
  /**
   * The tables' migrations are hand-applied, so a page can ship before its
   * table exists: a missing table reads as an empty one.
   */
  static async listJSON(
    def: SpecTableDef,
    params: HhdbListParams,
  ): Promise<HhdbListResult<SpecTableRow>> {
    const { countSql, countParams, rowsSql, rowsParams } =
      buildSpecTableListSql(def, params);
    try {
      const [countResult, rows] = await Promise.all([
        rawQuery<{ cnt: number }>(countSql, countParams),
        rawQuery<Record<string, unknown>>(rowsSql, rowsParams),
      ]);
      return {
        rows: rows.map((r) => serializeRow(def, r)),
        total: Number(countResult[0]?.cnt ?? 0),
      };
    } catch (err) {
      if (isMissingTableError(err)) return { rows: [], total: 0 };
      throw err;
    }
  }
}
