import { rawQuery } from "@/lib/mysql/hhdb";

import {
  hhdbTgTransactionRowToJSON,
  TG_SORTABLE_COLUMNS,
  TG_TRANSACTION_COLUMN_NAMES,
  type HhdbTgTransactionAttrs,
  type HhdbTgTransactionJSON,
} from "../models/hhdb-tg-transaction";
import type { HhdbListParams, HhdbListResult } from "../types/hhdb";
import { isMissingTableError } from "../utils/hhdb-missing-table";

const TABLE = "`tg_transactions`";

const q = (column: string) => `\`${column}\``;

/**
 * tg_transactions is ~3.7M rows / 2.3 GB against a 1.2 GB buffer pool, so any
 * query that has to touch rows outside an index is a multi-second (cold:
 * multi-minute) scan. The list view therefore only sorts and searches on
 * indexed columns (TG_SORTABLE_COLUMNS mirrors the KEY list in
 * tg_transactions.sql); a sort on anything else silently falls back to recDate.
 */
const SORTABLE: ReadonlySet<string> = new Set(TG_SORTABLE_COLUMNS);

/**
 * Search is a prefix match on ONE indexed column, chosen from the shape of
 * the term: dashed digits are a TMK ("1-2-3-004"), bare digits an undashed
 * tax key ("123004"), anything else a neighborhood name ("Kai"). One column
 * means one index range scan (well under a second on the remote). OR-ing the
 * three columns instead makes MariaDB sort_union three ranges and then fetch
 * every matching row for COUNT(*) — measured at 30–46 s on 2026-09-22.
 */
export function searchColumn(term: string): "tmk" | "taxKey" | "neighborhood" {
  if (/^[\d-]+$/.test(term)) return term.includes("-") ? "tmk" : "taxKey";
  return "neighborhood";
}

const SELECT_LIST = TG_TRANSACTION_COLUMN_NAMES.map(q).join(", ");

/** Pure SQL builder, exported for tests. */
export function buildTgTransactionListSql(params: HhdbListParams) {
  const { page, limit, search, sort = "recDate", order = "desc" } = params;
  const offset = (page - 1) * limit;
  const sortCol = SORTABLE.has(sort) ? sort : "recDate";
  const sortDir = order === "asc" ? "ASC" : "DESC";

  let where = "";
  const qp: (string | number)[] = [];
  const term = search?.trim();
  if (term) {
    where = ` WHERE ${q(searchColumn(term))} LIKE ?`;
    qp.push(`${term}%`);
  }

  // InnoDB secondary indexes are ordered (col, PK), so `col, id` is served
  // straight from the index and keeps pagination stable across equal values.
  const orderBy =
    sortCol === "id"
      ? `${q("id")} ${sortDir}`
      : `${q(sortCol)} ${sortDir}, ${q("id")} ${sortDir}`;

  return {
    countSql: `SELECT COUNT(*) AS cnt FROM ${TABLE}${where}`,
    countParams: qp,
    rowsSql: `SELECT ${SELECT_LIST} FROM ${TABLE}${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    rowsParams: [...qp, limit, offset],
    filtered: qp.length > 0,
  };
}

/**
 * The unfiltered COUNT(*) walks the whole primary key (seconds warm, longer
 * cold) and every page of the default view asks for it, so it is memoized
 * per process. Filtered counts are index range scans and are not cached.
 */
const TOTAL_TTL_MS = 10 * 60 * 1000;
let cachedTotal: { value: number; expiresAt: number } | null = null;

async function totalCount(sql: string, params: (string | number)[]) {
  const now = Date.now();
  if (cachedTotal && cachedTotal.expiresAt > now) return cachedTotal.value;
  const rows = await rawQuery<{ cnt: number }>(sql, params);
  const value = Number(rows[0]?.cnt ?? 0);
  cachedTotal = { value, expiresAt: now + TOTAL_TTL_MS };
  return value;
}

export default class HhdbTgTransactionCollection {
  /** Missing table reads as empty (the DDL is applied by hand), anything else throws. */
  static async listJSON(
    params: HhdbListParams,
  ): Promise<HhdbListResult<HhdbTgTransactionJSON>> {
    const { countSql, countParams, rowsSql, rowsParams, filtered } =
      buildTgTransactionListSql(params);

    try {
      const [total, rows] = await Promise.all([
        filtered
          ? rawQuery<{ cnt: number }>(countSql, countParams).then((r) =>
              Number(r[0]?.cnt ?? 0),
            )
          : totalCount(countSql, countParams),
        rawQuery<HhdbTgTransactionAttrs>(rowsSql, rowsParams),
      ]);

      return { rows: rows.map(hhdbTgTransactionRowToJSON), total };
    } catch (err) {
      if (isMissingTableError(err)) return { rows: [], total: 0 };
      throw err;
    }
  }
}
