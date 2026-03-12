import { rawQuery } from "@/lib/mysql/hhdb";

import {
  type FreqRow,
  type FreqSummaryParams,
  type FreqSummaryResult,
} from "../types/hhdb";
import { getSummaryFieldDefs } from "../types/hhdb-data-dictionary";

export default class HhdbSummaryCollection {
  /** Total row count for a table. Table name validated against dictionary. */
  static async getTableCount(table: string): Promise<number> {
    const fields = getSummaryFieldDefs(table);
    if (!fields) throw new Error(`Invalid HHDB table: ${table}`);
    const rows = await rawQuery<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM ${table}`,
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  /**
   * Fetch pre-computed frequency data from a freq_ table for a given column.
   * Returns rows pivoted by column_value with per-county counts.
   */
  static async getFreqSummary(
    table: string,
    column: string,
    params: FreqSummaryParams,
  ): Promise<FreqSummaryResult> {
    // Validate table against dictionary whitelist (prevents SQL injection)
    const fields = getSummaryFieldDefs(table);
    if (!fields) throw new Error(`Invalid HHDB table: ${table}`);

    // Validate sortCol is a valid county code (prevents SQL injection in ORDER BY)
    const validSortCols = ["0", "1", "2", "3", "4"];
    const sortCol = validSortCols.includes(params.sortCol)
      ? params.sortCol
      : "0";
    const sortDir = params.sortDir === "asc" ? "ASC" : "DESC";
    const offset = (params.page - 1) * params.limit;

    const freqTable = `freq_${table}`;

    // Fetch generated_at + null row (always needed regardless of page)
    const metaRows = await rawQuery<{
      county_code: string;
      column_value: string;
      frequency: number;
      generated_at: Date | string;
    }>(
      `SELECT county_code, column_value, frequency, generated_at
       FROM ${freqTable}
       WHERE column_name = ? AND column_value = '[NULL]'`,
      [column],
    );

    let generatedAt: string | null = null;
    let nullRow: FreqRow | null = null;

    if (metaRows.length > 0) {
      const genAt = metaRows[0].generated_at;
      generatedAt =
        genAt instanceof Date ? genAt.toISOString() : String(genAt);
      const nullCounts: Record<string, number> = {};
      for (const r of metaRows) {
        nullCounts[r.county_code] = Number(r.frequency);
      }
      nullRow = { value: "[NULL]", counts: nullCounts };
    } else {
      // Try to get generated_at from any row
      const anyRow = await rawQuery<{ generated_at: Date | string }>(
        `SELECT generated_at FROM ${freqTable} WHERE column_name = ? LIMIT 1`,
        [column],
      );
      if (anyRow.length > 0) {
        const genAt = anyRow[0].generated_at;
        generatedAt =
          genAt instanceof Date ? genAt.toISOString() : String(genAt);
      }
    }

    // Total record counts per county (for null percentage calculation)
    const totalCountRows = await rawQuery<{
      county_code: string;
      total: number;
    }>(
      `SELECT county_code, SUM(frequency) AS total
       FROM ${freqTable}
       WHERE column_name = ?
       GROUP BY county_code`,
      [column],
    );
    const totalCounts: Record<string, number> = {};
    for (const r of totalCountRows) {
      totalCounts[r.county_code] = Number(r.total);
    }

    // Count distinct values (excluding [NULL])
    const searchFilter =
      params.search
        ? `AND column_value != '[NULL]' AND column_value LIKE ?`
        : `AND column_value != '[NULL]'`;
    const searchParams = params.search ? [column, `%${params.search}%`] : [column];

    const countRows = await rawQuery<{ cnt: number }>(
      `SELECT COUNT(DISTINCT column_value) AS cnt
       FROM ${freqTable}
       WHERE column_name = ? ${searchFilter}`,
      searchParams,
    );
    const total = Number(countRows[0]?.cnt ?? 0);

    if (total === 0) {
      return { rows: [], total: 0, nullRow, totalCounts, generatedAt };
    }

    // Fetch the sorted, paginated page of distinct values
    // We pivot in the query: get the sort column's frequency for ordering,
    // then fetch all county rows for just those values
    const pageValues = await rawQuery<{ column_value: string }>(
      `SELECT column_value
       FROM ${freqTable}
       WHERE column_name = ? AND county_code = ? ${searchFilter.replace('column_value !=', 'column_value !=')}
       ORDER BY frequency ${sortDir}
       LIMIT ? OFFSET ?`,
      [...(params.search ? [column, sortCol, `%${params.search}%`] : [column, sortCol]), params.limit, offset],
    );

    if (pageValues.length === 0) {
      return { rows: [], total, nullRow, totalCounts, generatedAt };
    }

    const values = pageValues.map((r) => r.column_value);

    // Fetch all county rows for these values
    const placeholders = values.map(() => "?").join(",");
    const dataRows = await rawQuery<{
      county_code: string;
      column_value: string;
      frequency: number;
    }>(
      `SELECT county_code, column_value, frequency
       FROM ${freqTable}
       WHERE column_name = ? AND column_value IN (${placeholders})`,
      [column, ...values],
    );

    // Pivot by column_value
    const valueMap = new Map<string, Record<string, number>>();
    for (const r of dataRows) {
      let counts = valueMap.get(r.column_value);
      if (!counts) {
        counts = {};
        valueMap.set(r.column_value, counts);
      }
      counts[r.county_code] = Number(r.frequency);
    }

    // Maintain the sort order from the pageValues query
    const resultRows: FreqRow[] = [];
    for (const val of values) {
      const counts = valueMap.get(val);
      if (counts) {
        resultRows.push({ value: val, counts });
      }
    }

    return {
      rows: resultRows,
      total,
      nullRow,
      totalCounts,
      generatedAt,
    };
  }
}
