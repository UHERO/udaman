import { rawQuery } from "@/lib/mysql/hhdb";
import {
  HHDB_FIELDS,
  type FactorResult,
  type IslandCounts,
} from "../types/hhdb";

/** Valid table names in the HHDB factor config. */
const VALID_TABLES = new Set(Object.keys(HHDB_FIELDS));

/** Pivot flat (value, island, count) rows into grouped records. */
function pivotByIsland(
  rows: { value: string; island: string; count: number }[],
): { value: string; counts: IslandCounts; total: number }[] {
  const map = new Map<
    string,
    { counts: IslandCounts; total: number }
  >();
  for (const r of rows) {
    const val = String(r.value);
    let entry = map.get(val);
    if (!entry) {
      entry = { counts: {}, total: 0 };
      map.set(val, entry);
    }
    const cnt = Number(r.count);
    entry.counts[r.island] = (entry.counts[r.island] ?? 0) + cnt;
    entry.total += cnt;
  }
  return Array.from(map, ([value, { counts, total }]) => ({
    value,
    counts,
    total,
  }));
}

export default class HhdbFactorCollection {
  /**
   * Fetch factor values or min/max range for a given table + column.
   * Table and column are validated against the HHDB_FIELDS whitelist
   * to prevent SQL injection.
   * Factor counts are grouped by island (derived from LEFT(tmk,1)).
   */
  static async getFactors(
    table: string,
    column: string,
  ): Promise<FactorResult> {
    if (!VALID_TABLES.has(table)) {
      throw new Error(`Invalid HHDB table: ${table}`);
    }

    const fields = HHDB_FIELDS[table];
    const fieldDef = fields.find((f) => f.column === column);
    if (!fieldDef) {
      throw new Error(`Invalid column "${column}" for table "${table}"`);
    }

    if (fieldDef.type === "factor") {
      const [rows, nullRows] = await Promise.all([
        rawQuery<{ value: string; island: string; count: number }>(
          `SELECT ${column} AS value, LEFT(tmk, 1) AS island, COUNT(*) AS count
           FROM ${table}
           WHERE ${column} IS NOT NULL AND ${column} != ''
           GROUP BY ${column}, LEFT(tmk, 1)
           ORDER BY ${column}, island`,
        ),
        rawQuery<{ island: string; cnt: number }>(
          `SELECT LEFT(tmk, 1) AS island, COUNT(*) AS cnt
           FROM ${table}
           WHERE ${column} IS NULL OR ${column} = ''
           GROUP BY LEFT(tmk, 1)`,
        ),
      ]);

      const nullCounts: IslandCounts = {};
      let nullTotal = 0;
      for (const r of nullRows) {
        const cnt = Number(r.cnt);
        nullCounts[r.island] = cnt;
        nullTotal += cnt;
      }

      return {
        type: "factor",
        values: pivotByIsland(rows),
        nullCounts,
        nullTotal,
      };
    }

    // range type
    const rows = await rawQuery<{ min_val: string; max_val: string }>(
      `SELECT MIN(${column}) AS min_val, MAX(${column}) AS max_val
       FROM ${table}
       WHERE ${column} IS NOT NULL AND ${column} != ''`,
    );
    const row = rows[0];
    return {
      type: "range",
      min: row?.min_val != null ? String(row.min_val) : "",
      max: row?.max_val != null ? String(row.max_val) : "",
      format: fieldDef.format ?? "text",
    };
  }
}
