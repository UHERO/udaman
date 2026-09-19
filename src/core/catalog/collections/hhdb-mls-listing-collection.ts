import { rawQuery } from "@/lib/mysql/hhdb";

import {
  hhdbMlsListingRowToJSON,
  MLS_LISTING_SELECT_COLUMNS,
  type HhdbMlsListingAttrs,
  type HhdbMlsListingJSON,
} from "../models/hhdb-mls-listing";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";
import { isMissingTableError } from "../utils/hhdb-missing-table";

const TABLE = "`mls_listings`";

/**
 * Every identifier is backtick-quoted: mls_listings has columns named `view`,
 * `security` and `pool`, and the column list is generated, so a future
 * reserved word must not be able to break the query.
 */
const q = (column: string) => `\`${column}\``;

/** Sort whitelist = the selected columns (values come from code, never the request). */
const SORTABLE: ReadonlySet<string> = new Set(MLS_LISTING_SELECT_COLUMNS);

const SELECT_LIST = MLS_LISTING_SELECT_COLUMNS.map(q).join(", ");

/** Columns the search box matches against. */
const SEARCH_COLUMNS = [
  "mls_number",
  "tmk",
  "island",
  "status",
  "property_type",
  "region",
  "neighborhood",
  "address",
];

/** Pure SQL builder, exported for tests. */
export function buildMlsListingListSql(params: HhdbListParams) {
  const { page, limit, search, sort = "list_date", order = "desc" } = params;
  const offset = (page - 1) * limit;
  const sortCol = SORTABLE.has(sort) ? sort : "list_date";
  const sortDir = order === "asc" ? "ASC" : "DESC";

  let where = "";
  const qp: (string | number)[] = [];
  if (search) {
    where = ` WHERE (${SEARCH_COLUMNS.map((c) => `${q(c)} LIKE ?`).join(" OR ")})`;
    const term = `%${search}%`;
    for (let i = 0; i < SEARCH_COLUMNS.length; i++) qp.push(term);
  }

  // `id` tie-break keeps pagination stable across equal sort values.
  const orderBy =
    sortCol === "id"
      ? `${q("id")} ${sortDir}`
      : `${q(sortCol)} ${sortDir}, ${q("id")} ${sortDir}`;

  return {
    countSql: `SELECT COUNT(*) AS cnt FROM ${TABLE}${where}`,
    countParams: qp,
    rowsSql: `SELECT ${SELECT_LIST} FROM ${TABLE}${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    rowsParams: [...qp, limit, offset],
  };
}

export default class HhdbMlsListingCollection {
  /**
   * The table's migration is hand-applied, so the page can ship before the
   * table exists: a missing table reads as an empty one. Any other error
   * still throws.
   */
  static async listJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbMlsListingJSON>> {
    const { countSql, countParams, rowsSql, rowsParams } =
      buildMlsListingListSql(params);

    try {
      const [countResult, rows] = await Promise.all([
        rawQuery<{ cnt: number }>(countSql, countParams),
        rawQuery<HhdbMlsListingAttrs>(rowsSql, rowsParams),
      ]);

      return {
        rows: rows.map(hhdbMlsListingRowToJSON),
        total: Number(countResult[0]?.cnt ?? 0),
      };
    } catch (err) {
      if (isMissingTableError(err)) return { rows: [], total: 0 };
      throw err;
    }
  }
}
