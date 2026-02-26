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

/** Compute median via LIMIT 1 OFFSET for a given group. */
async function queryMedian(
  table: string,
  column: string,
  islandFilter: string | null,
  count: number,
): Promise<number> {
  if (count === 0) return 0;
  const offset = Math.floor(count / 2);
  const where = islandFilter
    ? `WHERE LEFT(tmk, 1) = ? AND ${column} IS NOT NULL AND ${column} != ''`
    : `WHERE ${column} IS NOT NULL AND ${column} != ''`;
  const params: (string | number)[] = islandFilter ? [islandFilter, 1, offset] : [1, offset];
  const rows = await rawQuery<{ med: number }>(
    `SELECT ABS(${column}) AS med FROM ${table} ${where} ORDER BY ABS(${column}) LIMIT ? OFFSET ?`,
    params,
  );
  return rows.length > 0 ? Number(rows[0].med) : 0;
}

export default class HhdbFactorCollection {
  /**
   * Fetch factor values or min/max/median range for a given table + column.
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

    // range type — per-island min, max, median using ABS()
    const statsRows = await rawQuery<{
      island: string;
      min_val: number;
      max_val: number;
      cnt: number;
    }>(
      `SELECT LEFT(tmk, 1) AS island,
              MIN(ABS(${column})) AS min_val,
              MAX(ABS(${column})) AS max_val,
              COUNT(*) AS cnt
       FROM ${table}
       WHERE ${column} IS NOT NULL AND ${column} != ''
       GROUP BY LEFT(tmk, 1)
       ORDER BY island`,
    );

    // Overall stats
    const overallRow = await rawQuery<{
      min_val: number;
      max_val: number;
      cnt: number;
    }>(
      `SELECT MIN(ABS(${column})) AS min_val,
              MAX(ABS(${column})) AS max_val,
              COUNT(*) AS cnt
       FROM ${table}
       WHERE ${column} IS NOT NULL AND ${column} != ''`,
    );

    const overall = overallRow[0];
    const overallCount = Number(overall?.cnt ?? 0);

    // Compute medians in parallel: one per island + overall
    const islandStats = statsRows.map((r) => ({
      island: String(r.island),
      min: Number(r.min_val),
      max: Number(r.max_val),
      count: Number(r.cnt),
    }));

    const medianPromises = [
      ...islandStats.map((s) =>
        queryMedian(table, column, s.island, s.count),
      ),
      queryMedian(table, column, null, overallCount),
    ];
    const medians = await Promise.all(medianPromises);

    const islands = islandStats.map((s, i) => ({
      ...s,
      median: medians[i],
    }));

    return {
      type: "range",
      format: fieldDef.format ?? "text",
      islands,
      overall: {
        min: Number(overall?.min_val ?? 0),
        max: Number(overall?.max_val ?? 0),
        median: medians[medians.length - 1],
        count: overallCount,
      },
    };
  }
}
