import { ticks } from "d3-array";

import { rawQuery } from "@/lib/mysql/hhdb";

import {
  type IslandCounts,
  type SummaryResult,
  type SummaryViewType,
} from "../types/hhdb";
import { getSummaryFieldDefs } from "../types/hhdb-data-dictionary";

/** Pivot flat (value, island, count) rows into grouped records. */
function pivotByIsland(
  rows: { value: string; island: string; count: number }[],
): { value: string; counts: IslandCounts; total: number }[] {
  const map = new Map<string, { counts: IslandCounts; total: number }>();
  for (const r of rows) {
    const raw: unknown = r.value;
    const val =
      raw instanceof Date
        ? raw.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : String(raw);
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
  const params: (string | number)[] = islandFilter
    ? [islandFilter, 1, offset]
    : [1, offset];
  const rows = await rawQuery<{ med: number }>(
    `SELECT ABS(${column}) AS med FROM ${table} ${where} ORDER BY ABS(${column}) LIMIT ? OFFSET ?`,
    params,
  );
  return rows.length > 0 ? Number(rows[0].med) : 0;
}

function formatBucketLabel(min: number, max: number, format: string): string {
  const fmt = (n: number) => {
    if (format === "dollar") {
      if (n >= 1_000_000_000)
        return `$${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)}bil`;
      if (n >= 1_000_000)
        return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}mil`;
      if (n >= 1_000)
        return `$${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
      return `$${n.toLocaleString()}`;
    }
    if (format === "year") return String(n);
    return n.toLocaleString();
  };
  return `${fmt(min)} – ${fmt(max)}`;
}

export default class HhdbSummaryCollection {
  /**
   * Fetch summary values or min/max/median range for a given table + column.
   * Table and column are validated against the HHDB_FIELDS whitelist
   * to prevent SQL injection.
   */
  static async getSummaries(
    table: string,
    column: string,
    viewType: SummaryViewType,
    sortBy?: string,
  ): Promise<SummaryResult> {
    const fields = getSummaryFieldDefs(table, viewType);
    if (!fields) {
      throw new Error(`Invalid HHDB table: ${table}`);
    }

    const fieldDef = fields.find((f) => f.column === column);
    if (!fieldDef) {
      throw new Error(
        `Invalid column "${column}" for table "${table}" with view type "${viewType}"`,
      );
    }

    if (viewType === "rank") {
      // Step 1: find top 20 values, optionally filtered by island
      const islandSort = sortBy && sortBy !== "total";
      const top20 = islandSort
        ? await rawQuery<{ value: string }>(
            `SELECT ${column} AS value, COUNT(*) AS cnt
             FROM ${table}
             WHERE ${column} IS NOT NULL AND ${column} != ''
               AND LEFT(tmk, 1) = ?
             GROUP BY ${column}
             ORDER BY cnt DESC
             LIMIT 20`,
            [sortBy],
          )
        : await rawQuery<{ value: string }>(
            `SELECT ${column} AS value, COUNT(*) AS cnt
             FROM ${table}
             WHERE ${column} IS NOT NULL AND ${column} != ''
             GROUP BY ${column}
             ORDER BY cnt DESC
             LIMIT 20`,
          );
      const topValues = top20.map((r) => r.value);

      // Step 2: get island breakdown + null counts in parallel
      const placeholders = topValues.map(() => "?").join(", ");
      const [rows, nullRows] = await Promise.all([
        topValues.length > 0
          ? rawQuery<{ value: string; island: string; count: number }>(
              `SELECT ${column} AS value, LEFT(tmk, 1) AS island, COUNT(*) AS count
               FROM ${table}
               WHERE ${column} IN (${placeholders})
               GROUP BY ${column}, LEFT(tmk, 1)`,
              topValues,
            )
          : Promise.resolve([]),
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

      const values = pivotByIsland(rows).sort((a, b) =>
        islandSort
          ? (b.counts[sortBy!] ?? 0) - (a.counts[sortBy!] ?? 0)
          : b.total - a.total,
      );

      return {
        type: "rank",
        values,
        nullCounts,
        nullTotal,
      };
    }

    if (viewType === "summary") {
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
        type: "summary",
        values: pivotByIsland(rows),
        nullCounts,
        nullTotal,
      };
    }

    // range type — per-island min, max, median using ABS()
    const [statsRows, overallRow, nullRows] = await Promise.all([
      rawQuery<{
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
      ),
      rawQuery<{
        min_val: number;
        max_val: number;
        cnt: number;
      }>(
        `SELECT MIN(ABS(${column})) AS min_val,
                MAX(ABS(${column})) AS max_val,
                COUNT(*) AS cnt
         FROM ${table}
         WHERE ${column} IS NOT NULL AND ${column} != ''`,
      ),
      rawQuery<{ island: string; cnt: number }>(
        `SELECT LEFT(tmk, 1) AS island, COUNT(*) AS cnt
         FROM ${table}
         WHERE ${column} IS NULL OR ${column} = ''
         GROUP BY LEFT(tmk, 1)`,
      ),
    ]);

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
      ...islandStats.map((s) => queryMedian(table, column, s.island, s.count)),
      queryMedian(table, column, null, overallCount),
    ];
    const medians = await Promise.all(medianPromises);

    const islands = islandStats.map((s, i) => ({
      ...s,
      median: medians[i],
    }));

    const nullCounts: IslandCounts = {};
    let nullTotal = 0;
    for (const r of nullRows) {
      const cnt = Number(r.cnt);
      nullCounts[r.island] = cnt;
      nullTotal += cnt;
    }

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
      nullCounts,
      nullTotal,
    };
  }

  /**
   * Compute a distribution (bucketed histogram) for a numeric column.
   *
   * Outlier-aware: queries P5 and P95 percentile values, builds 8 evenly
   * spaced buckets in the P5–P95 core range using d3 ticks, then adds a
   * lower-outlier bucket (< P5) and an upper-outlier bucket (> P95).
   * This prevents extreme values from compressing the entire distribution
   * into a single bucket.
   */
  static async getDistribution(
    table: string,
    column: string,
  ): Promise<SummaryResult> {
    // Validate column against dictionary whitelist
    const fields = getSummaryFieldDefs(table, "range");
    if (!fields) throw new Error(`Invalid HHDB table: ${table}`);
    const fieldDef = fields.find((f) => f.column === column);
    if (!fieldDef)
      throw new Error(
        `Invalid column "${column}" for distribution on "${table}"`,
      );

    const format = fieldDef.format ?? "text";
    // Only compute distribution for numeric formats
    if (format === "text") {
      return {
        type: "distribution",
        format,
        buckets: [],
        nullCounts: {},
        nullTotal: 0,
      };
    }

    // Step 1: get total count, min, max
    const [statsRow] = await rawQuery<{
      min_val: number;
      max_val: number;
      cnt: number;
    }>(
      `SELECT MIN(ABS(${column})) AS min_val, MAX(ABS(${column})) AS max_val, COUNT(*) AS cnt
       FROM ${table}
       WHERE ${column} IS NOT NULL AND ${column} != ''`,
    );
    const totalCount = Number(statsRow?.cnt ?? 0);
    const minVal = Number(statsRow?.min_val ?? 0);
    const maxVal = Number(statsRow?.max_val ?? 0);

    if (totalCount === 0 || minVal === maxVal) {
      return {
        type: "distribution",
        format,
        buckets: [],
        nullCounts: {},
        nullTotal: 0,
      };
    }

    // Step 2: Query P5 and P95 percentile values via LIMIT 1 OFFSET
    const p5Offset = Math.floor(totalCount * 0.05);
    const p95Offset = Math.floor(totalCount * 0.95);

    const [p5Rows, p95Rows] = await Promise.all([
      rawQuery<{ val: number }>(
        `SELECT ABS(${column}) AS val FROM ${table}
         WHERE ${column} IS NOT NULL AND ${column} != ''
         ORDER BY ABS(${column})
         LIMIT 1 OFFSET ?`,
        [p5Offset],
      ),
      rawQuery<{ val: number }>(
        `SELECT ABS(${column}) AS val FROM ${table}
         WHERE ${column} IS NOT NULL AND ${column} != ''
         ORDER BY ABS(${column})
         LIMIT 1 OFFSET ?`,
        [p95Offset],
      ),
    ]);
    const p5 = Number(p5Rows[0]?.val ?? minVal);
    const p95 = Number(p95Rows[0]?.val ?? maxVal);

    // Step 3: Build bucket boundaries
    // If P5 == P95 (very low variance), fall back to min/max ticks
    let boundaries: number[];
    if (p5 >= p95) {
      const tickValues = ticks(minVal, maxVal, 10);
      if (tickValues.length < 2) {
        return {
          type: "distribution",
          format,
          buckets: [],
          nullCounts: {},
          nullTotal: 0,
        };
      }
      boundaries = [minVal, ...tickValues];
      if (tickValues[tickValues.length - 1] < maxVal) boundaries.push(maxVal);
    } else {
      // 8 nice inner ticks between P5 and P95
      const innerTicks = ticks(p5, p95, 8);
      // Deduplicate and ensure P5/P95 boundaries are included
      const inner = innerTicks.filter((t) => t > p5 && t < p95);
      // boundaries: [min, p5, ...inner ticks..., p95, max]
      boundaries = [minVal];
      if (p5 > minVal) boundaries.push(p5);
      boundaries.push(...inner);
      if (p95 < maxVal) boundaries.push(p95);
      boundaries.push(maxVal);
    }

    // Step 4: Build CASE WHEN SQL
    const bucketCount = boundaries.length - 1;
    const caseLines: string[] = [];
    for (let i = 0; i < bucketCount; i++) {
      if (i === bucketCount - 1) {
        caseLines.push(`ELSE ${i}`);
      } else {
        caseLines.push(`WHEN ABS(${column}) < ${boundaries[i + 1]} THEN ${i}`);
      }
    }

    const caseExpr = `CASE ${caseLines.join(" ")} END`;

    const [rows, nullRows] = await Promise.all([
      rawQuery<{ bucket_idx: number; island: string; count: number }>(
        `SELECT ${caseExpr} AS bucket_idx,
                LEFT(tmk, 1) AS island,
                COUNT(*) AS count
         FROM ${table}
         WHERE ${column} IS NOT NULL AND ${column} != ''
         GROUP BY bucket_idx, island`,
      ),
      rawQuery<{ island: string; cnt: number }>(
        `SELECT LEFT(tmk, 1) AS island, COUNT(*) AS cnt
         FROM ${table}
         WHERE ${column} IS NULL OR ${column} = ''
         GROUP BY LEFT(tmk, 1)`,
      ),
    ]);

    // Step 5: Assemble buckets
    const bucketMap = new Map<
      number,
      { counts: IslandCounts; total: number }
    >();
    for (const r of rows) {
      const idx = Number(r.bucket_idx);
      let entry = bucketMap.get(idx);
      if (!entry) {
        entry = { counts: {}, total: 0 };
        bucketMap.set(idx, entry);
      }
      const cnt = Number(r.count);
      entry.counts[r.island] = (entry.counts[r.island] ?? 0) + cnt;
      entry.total += cnt;
    }

    const buckets = [];
    for (let i = 0; i < bucketCount; i++) {
      const entry = bucketMap.get(i) ?? { counts: {}, total: 0 };
      buckets.push({
        label: formatBucketLabel(boundaries[i], boundaries[i + 1], format),
        min: boundaries[i],
        max: boundaries[i + 1],
        counts: entry.counts,
        total: entry.total,
      });
    }

    const nullCounts: IslandCounts = {};
    let nullTotal = 0;
    for (const r of nullRows) {
      const cnt = Number(r.cnt);
      nullCounts[r.island] = cnt;
      nullTotal += cnt;
    }

    return {
      type: "distribution",
      format,
      buckets,
      nullCounts,
      nullTotal,
    };
  }
}
