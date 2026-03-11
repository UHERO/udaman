import { ticks } from "d3-array";

import { rawQuery } from "@/lib/mysql/hhdb";

import type {
  CategoricalDrilldown,
  CategoricalFieldSummary,
  ColumnInfo,
  CountyCounts,
  CountyName,
  FieldCategory,
  NumericDrilldown,
  NumericFieldSummary,
  OverviewData,
  OverviewRow,
  TemporalDrilldown,
  TemporalFieldSummary,
  TextDrilldown,
  TextFieldSummary,
} from "../types/hhdb";
import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";
import {
  classifyField,
  columnLabel,
} from "../utils/hhdb-field-classifier";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const validTables = new Set(
  Object.values(HHDB_TABLE_CONFIG)
    .map((c) => c.fieldsTable)
    .filter(Boolean) as string[],
);

function resolveTable(table: string): string {
  if (!validTables.has(table)) {
    throw new Error(`Invalid HHDB table: ${table}`);
  }
  return table;
}

/** Cache column info per table within a module-level map. */
const columnInfoCache = new Map<string, ColumnInfo[]>();

async function getColumnInfoCached(table: string): Promise<ColumnInfo[]> {
  const cached = columnInfoCache.get(table);
  if (cached) return cached;
  const cols = await getColumnInfo(table);
  columnInfoCache.set(table, cols);
  return cols;
}

async function validateColumn(
  table: string,
  column: string,
): Promise<ColumnInfo> {
  const cols = await getColumnInfoCached(table);
  const col = cols.find((c) => c.columnName === column);
  if (!col) {
    throw new Error(
      `Invalid column "${column}" for table "${table}"`,
    );
  }
  return col;
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

async function getColumnInfo(table: string): Promise<ColumnInfo[]> {
  resolveTable(table);
  const rows = await rawQuery<{
    COLUMN_NAME: string;
    DATA_TYPE: string;
    COLUMN_TYPE: string;
    IS_NULLABLE: string;
    ORDINAL_POSITION: number;
  }>(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, ORDINAL_POSITION
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table],
  );
  return rows.map((r) => ({
    columnName: r.COLUMN_NAME,
    dataType: r.DATA_TYPE,
    columnType: r.COLUMN_TYPE,
    isNullable: r.IS_NULLABLE === "YES",
    ordinalPosition: r.ORDINAL_POSITION,
  }));
}

/** SQL CASE expression mapping TMK first digit → county name. */
const COUNTY_CASE = `CASE LEFT(tmk, 1)
  WHEN '1' THEN 'Honolulu'
  WHEN '2' THEN 'Maui'
  WHEN '3' THEN 'Hawaii'
  WHEN '4' THEN 'Kauai'
END`;

function emptyCountyCounts(): CountyCounts {
  return { Honolulu: 0, Maui: 0, Hawaii: 0, Kauai: 0 };
}

async function getOverview(table: string): Promise<OverviewData> {
  resolveTable(table);
  const columns = await getColumnInfoCached(table);
  const hasTmk = columns.some((c) => c.columnName === "tmk");

  // Get total row count
  const [countRow] = await rawQuery<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM ${table}`,
  );
  const totalRows = Number(countRow?.cnt ?? 0);

  if (totalRows === 0) {
    return { rows: [], totalRows: 0 };
  }

  // County totals (if tmk column exists)
  let countyTotals: CountyCounts | undefined;
  if (hasTmk) {
    const countyRows = await rawQuery<{ county: string; cnt: number }>(
      `SELECT ${COUNTY_CASE} AS county, COUNT(*) AS cnt FROM ${table} GROUP BY county`,
    );
    countyTotals = emptyCountyCounts();
    for (const r of countyRows) {
      const name = r.county as CountyName;
      if (name && countyTotals[name] != null) {
        countyTotals[name] += Number(r.cnt);
      }
    }
  }

  // Per-column stats in parallel
  const stats = await Promise.all(
    columns.map(async (col) => {
      const [row] = await rawQuery<{
        non_null: number;
        distinct_count: number;
      }>(
        `SELECT COUNT(\`${col.columnName}\`) AS non_null, COUNT(DISTINCT \`${col.columnName}\`) AS distinct_count FROM ${table}`,
      );

      // Per-county non-null counts
      let countyNonNull: CountyCounts | undefined;
      if (hasTmk) {
        const countyRows = await rawQuery<{ county: string; cnt: number }>(
          `SELECT ${COUNTY_CASE} AS county, COUNT(\`${col.columnName}\`) AS cnt FROM ${table} GROUP BY county`,
        );
        countyNonNull = emptyCountyCounts();
        for (const r of countyRows) {
          const name = r.county as CountyName;
          if (name && countyNonNull[name] != null) {
            countyNonNull[name] += Number(r.cnt);
          }
        }
      }

      return {
        columnName: col.columnName,
        nonNull: Number(row?.non_null ?? 0),
        distinct: Number(row?.distinct_count ?? 0),
        dataType: col.dataType,
        columnType: col.columnType,
        countyNonNull,
      };
    }),
  );

  const rows: OverviewRow[] = stats.map((s) => {
    const nullCount = totalRows - s.nonNull;
    const category = classifyField(
      s.columnName,
      s.dataType,
      s.columnType,
      s.distinct,
    );
    return {
      columnName: s.columnName,
      fieldCategory: category,
      dataType: s.dataType,
      label: columnLabel(table, s.columnName),
      nonNullCount: s.nonNull,
      nullCount,
      nullPercent: totalRows > 0 ? (nullCount / totalRows) * 100 : 0,
      distinctCount: s.distinct,
      totalRows,
      countyNonNull: s.countyNonNull,
    };
  });

  return { rows, totalRows, countyTotals };
}

async function getCategoricalSummaries(
  table: string,
): Promise<CategoricalFieldSummary[]> {
  resolveTable(table);
  const overview = await getOverview(table);
  const catFields = overview.rows.filter(
    (r) => r.fieldCategory === "low-cardinality",
  );

  const summaries = await Promise.all(
    catFields.map(async (field) => {
      const topRows = await rawQuery<{ value: string; cnt: number }>(
        `SELECT \`${field.columnName}\` AS value, COUNT(*) AS cnt
         FROM ${table}
         WHERE \`${field.columnName}\` IS NOT NULL AND \`${field.columnName}\` != ''
         GROUP BY \`${field.columnName}\`
         ORDER BY cnt DESC
         LIMIT 5`,
      );

      const topValues = topRows.map((r) => ({
        value: String(r.value),
        count: Number(r.cnt),
        percent:
          field.nonNullCount > 0
            ? (Number(r.cnt) / field.nonNullCount) * 100
            : 0,
      }));

      return {
        columnName: field.columnName,
        label: field.label,
        distinctCount: field.distinctCount,
        topValues,
      };
    }),
  );

  return summaries;
}

async function getCategoricalDrilldown(
  table: string,
  column: string,
): Promise<CategoricalDrilldown> {
  resolveTable(table);
  await validateColumn(table, column);

  const [statsRow] = await rawQuery<{
    non_null: number;
    null_count: number;
    distinct_count: number;
  }>(
    `SELECT COUNT(\`${column}\`) AS non_null,
            COUNT(*) - COUNT(\`${column}\`) AS null_count,
            COUNT(DISTINCT \`${column}\`) AS distinct_count
     FROM ${table}`,
  );
  const totalNonNull = Number(statsRow?.non_null ?? 0);
  const totalNull = Number(statsRow?.null_count ?? 0);
  const distinctCount = Number(statsRow?.distinct_count ?? 0);

  const rows = await rawQuery<{ value: string; cnt: number }>(
    `SELECT \`${column}\` AS value, COUNT(*) AS cnt
     FROM ${table}
     WHERE \`${column}\` IS NOT NULL AND \`${column}\` != ''
     GROUP BY \`${column}\`
     ORDER BY cnt DESC`,
  );

  let cumulative = 0;
  const values = rows.map((r) => {
    const count = Number(r.cnt);
    const percent = totalNonNull > 0 ? (count / totalNonNull) * 100 : 0;
    cumulative += percent;
    return {
      value: String(r.value),
      count,
      percent,
      cumulative,
    };
  });

  return {
    columnName: column,
    label: columnLabel(table, column),
    totalNonNull,
    totalNull,
    distinctCount,
    mode: values.length > 0 ? values[0].value : "",
    values,
  };
}

async function getNumericSummaries(
  table: string,
): Promise<NumericFieldSummary[]> {
  resolveTable(table);
  const overview = await getOverview(table);
  const numericCategories: FieldCategory[] = [
    "large-dollar",
    "small-dollar",
    "year",
    "area",
    "count",
  ];
  const numFields = overview.rows.filter((r) =>
    numericCategories.includes(r.fieldCategory),
  );

  const summaries = await Promise.all(
    numFields.map(async (field) => {
      const [statsRow] = await rawQuery<{
        min_val: number;
        max_val: number;
        cnt: number;
        null_count: number;
      }>(
        `SELECT MIN(\`${field.columnName}\`) AS min_val,
                MAX(\`${field.columnName}\`) AS max_val,
                COUNT(\`${field.columnName}\`) AS cnt,
                COUNT(*) - COUNT(\`${field.columnName}\`) AS null_count
         FROM ${table}`,
      );

      const nonNullCount = Number(statsRow?.cnt ?? 0);
      let median = 0;
      if (nonNullCount > 0) {
        const offset = Math.floor(nonNullCount / 2);
        const [medRow] = await rawQuery<{ med: number }>(
          `SELECT \`${field.columnName}\` AS med FROM ${table}
           WHERE \`${field.columnName}\` IS NOT NULL
           ORDER BY \`${field.columnName}\`
           LIMIT 1 OFFSET ?`,
          [offset],
        );
        median = Number(medRow?.med ?? 0);
      }

      return {
        columnName: field.columnName,
        label: field.label,
        fieldCategory: field.fieldCategory,
        min: Number(statsRow?.min_val ?? 0),
        max: Number(statsRow?.max_val ?? 0),
        median,
        nullCount: Number(statsRow?.null_count ?? 0),
        nonNullCount,
      };
    }),
  );

  return summaries;
}

async function getNumericDrilldown(
  table: string,
  column: string,
): Promise<NumericDrilldown> {
  resolveTable(table);
  const colInfo = await validateColumn(table, column);
  const overview = await getOverview(table);
  const fieldRow = overview.rows.find((r) => r.columnName === column);
  const fieldCategory = fieldRow?.fieldCategory ?? "count";

  const [statsRow] = await rawQuery<{
    min_val: number;
    max_val: number;
    avg_val: number;
    cnt: number;
    null_count: number;
    zero_count: number;
    neg_count: number;
  }>(
    `SELECT MIN(\`${column}\`) AS min_val,
            MAX(\`${column}\`) AS max_val,
            AVG(\`${column}\`) AS avg_val,
            COUNT(\`${column}\`) AS cnt,
            COUNT(*) - COUNT(\`${column}\`) AS null_count,
            SUM(CASE WHEN \`${column}\` = 0 THEN 1 ELSE 0 END) AS zero_count,
            SUM(CASE WHEN \`${column}\` < 0 THEN 1 ELSE 0 END) AS neg_count
     FROM ${table}`,
  );

  const nonNullCount = Number(statsRow?.cnt ?? 0);
  const minVal = Number(statsRow?.min_val ?? 0);
  const maxVal = Number(statsRow?.max_val ?? 0);

  let median = 0;
  if (nonNullCount > 0) {
    const offset = Math.floor(nonNullCount / 2);
    const [medRow] = await rawQuery<{ med: number }>(
      `SELECT \`${column}\` AS med FROM ${table}
       WHERE \`${column}\` IS NOT NULL
       ORDER BY \`${column}\`
       LIMIT 1 OFFSET ?`,
      [offset],
    );
    median = Number(medRow?.med ?? 0);
  }

  // Build histogram based on field category
  let histogram: { label: string; min: number; max: number; count: number }[] =
    [];

  if (nonNullCount > 0 && minVal !== maxVal) {
    if (fieldCategory === "large-dollar") {
      // Fixed log buckets for large dollar amounts
      const fixedBuckets = [
        { label: "$0", min: 0, max: 0 },
        { label: "$1 – $10K", min: 1, max: 10_000 },
        { label: "$10K – $100K", min: 10_000, max: 100_000 },
        { label: "$100K – $500K", min: 100_000, max: 500_000 },
        { label: "$500K – $1M", min: 500_000, max: 1_000_000 },
        { label: "$1M – $2M", min: 1_000_000, max: 2_000_000 },
        { label: "$2M – $5M", min: 2_000_000, max: 5_000_000 },
        { label: "$5M+", min: 5_000_000, max: Number.MAX_SAFE_INTEGER },
      ];

      const caseLines = fixedBuckets.map((b, i) => {
        if (i === fixedBuckets.length - 1) return `ELSE ${i}`;
        if (b.min === b.max)
          return `WHEN \`${column}\` = ${b.min} THEN ${i}`;
        return `WHEN \`${column}\` >= ${b.min} AND \`${column}\` < ${b.max} THEN ${i}`;
      });
      const caseExpr = `CASE ${caseLines.join(" ")} END`;

      const rows = await rawQuery<{ bucket_idx: number; cnt: number }>(
        `SELECT ${caseExpr} AS bucket_idx, COUNT(*) AS cnt
         FROM ${table}
         WHERE \`${column}\` IS NOT NULL
         GROUP BY bucket_idx
         ORDER BY bucket_idx`,
      );

      const countMap = new Map(rows.map((r) => [Number(r.bucket_idx), Number(r.cnt)]));
      histogram = fixedBuckets.map((b, i) => ({
        label: b.label,
        min: b.min,
        max: b.max === Number.MAX_SAFE_INTEGER ? maxVal : b.max,
        count: countMap.get(i) ?? 0,
      }));
    } else if (fieldCategory === "year") {
      // Decade buckets
      const rows = await rawQuery<{ decade: number; cnt: number }>(
        `SELECT FLOOR(\`${column}\` / 10) * 10 AS decade, COUNT(*) AS cnt
         FROM ${table}
         WHERE \`${column}\` IS NOT NULL AND \`${column}\` > 0
         GROUP BY decade
         ORDER BY decade`,
      );
      histogram = rows.map((r) => ({
        label: `${r.decade}s`,
        min: Number(r.decade),
        max: Number(r.decade) + 9,
        count: Number(r.cnt),
      }));
    } else {
      // For count, small-dollar, area: check distinct count for enum-like
      const [distinctRow] = await rawQuery<{ dc: number }>(
        `SELECT COUNT(DISTINCT \`${column}\`) AS dc FROM ${table} WHERE \`${column}\` IS NOT NULL`,
      );
      const dc = Number(distinctRow?.dc ?? 0);

      if (dc <= 30) {
        // Enumerate distinct values
        const rows = await rawQuery<{ val: number; cnt: number }>(
          `SELECT \`${column}\` AS val, COUNT(*) AS cnt
           FROM ${table}
           WHERE \`${column}\` IS NOT NULL
           GROUP BY \`${column}\`
           ORDER BY \`${column}\``,
        );
        histogram = rows.map((r) => ({
          label: String(r.val),
          min: Number(r.val),
          max: Number(r.val),
          count: Number(r.cnt),
        }));
      } else {
        // Use P5-P95 range with d3 ticks (same pattern as existing code)
        const p5Offset = Math.floor(nonNullCount * 0.05);
        const p95Offset = Math.floor(nonNullCount * 0.95);

        const [p5Rows, p95Rows] = await Promise.all([
          rawQuery<{ val: number }>(
            `SELECT \`${column}\` AS val FROM ${table}
             WHERE \`${column}\` IS NOT NULL
             ORDER BY \`${column}\`
             LIMIT 1 OFFSET ?`,
            [p5Offset],
          ),
          rawQuery<{ val: number }>(
            `SELECT \`${column}\` AS val FROM ${table}
             WHERE \`${column}\` IS NOT NULL
             ORDER BY \`${column}\`
             LIMIT 1 OFFSET ?`,
            [p95Offset],
          ),
        ]);

        const p5 = Number(p5Rows[0]?.val ?? minVal);
        const p95 = Number(p95Rows[0]?.val ?? maxVal);

        let boundaries: number[];
        if (p5 >= p95) {
          const tickValues = ticks(minVal, maxVal, 10);
          if (tickValues.length < 2) {
            boundaries = [minVal, maxVal];
          } else {
            boundaries = [minVal, ...tickValues];
            if (tickValues[tickValues.length - 1] < maxVal)
              boundaries.push(maxVal);
          }
        } else {
          const innerTicks = ticks(p5, p95, 8);
          const inner = innerTicks.filter((t) => t > p5 && t < p95);
          boundaries = [minVal];
          if (p5 > minVal) boundaries.push(p5);
          boundaries.push(...inner);
          if (p95 < maxVal) boundaries.push(p95);
          boundaries.push(maxVal);
        }

        const bucketCount = boundaries.length - 1;
        if (bucketCount > 0) {
          const caseLines: string[] = [];
          for (let i = 0; i < bucketCount; i++) {
            if (i === bucketCount - 1) {
              caseLines.push(`ELSE ${i}`);
            } else {
              caseLines.push(
                `WHEN \`${column}\` < ${boundaries[i + 1]} THEN ${i}`,
              );
            }
          }
          const caseExpr = `CASE ${caseLines.join(" ")} END`;

          const rows = await rawQuery<{
            bucket_idx: number;
            cnt: number;
          }>(
            `SELECT ${caseExpr} AS bucket_idx, COUNT(*) AS cnt
             FROM ${table}
             WHERE \`${column}\` IS NOT NULL
             GROUP BY bucket_idx
             ORDER BY bucket_idx`,
          );

          const countMap = new Map(
            rows.map((r) => [Number(r.bucket_idx), Number(r.cnt)]),
          );
          histogram = Array.from({ length: bucketCount }, (_, i) => ({
            label: formatBucketLabel(
              boundaries[i],
              boundaries[i + 1],
              fieldCategory,
            ),
            min: boundaries[i],
            max: boundaries[i + 1],
            count: countMap.get(i) ?? 0,
          }));
        }
      }
    }
  }

  return {
    columnName: column,
    label: columnLabel(table, column),
    fieldCategory,
    min: minVal,
    max: maxVal,
    median,
    nullCount: Number(statsRow?.null_count ?? 0),
    nonNullCount,
    avg: Number(statsRow?.avg_val ?? 0),
    zeroCount: Number(statsRow?.zero_count ?? 0),
    negativeCount: Number(statsRow?.neg_count ?? 0),
    histogram,
  };
}

async function getTextSummaries(
  table: string,
): Promise<TextFieldSummary[]> {
  resolveTable(table);
  const overview = await getOverview(table);
  const textFields = overview.rows.filter(
    (r) =>
      r.fieldCategory === "identifier" ||
      r.fieldCategory === "high-cardinality",
  );

  const summaries = await Promise.all(
    textFields.map(async (field) => {
      const [row] = await rawQuery<{
        distinct_count: number;
        total_count: number;
        avg_len: number;
        null_count: number;
      }>(
        `SELECT COUNT(DISTINCT \`${field.columnName}\`) AS distinct_count,
                COUNT(\`${field.columnName}\`) AS total_count,
                AVG(CHAR_LENGTH(\`${field.columnName}\`)) AS avg_len,
                COUNT(*) - COUNT(\`${field.columnName}\`) AS null_count
         FROM ${table}`,
      );
      const totalCount = Number(row?.total_count ?? 0);
      const distinctCount = Number(row?.distinct_count ?? 0);
      const nullCount = Number(row?.null_count ?? 0);

      return {
        columnName: field.columnName,
        label: field.label,
        fieldCategory: field.fieldCategory,
        totalCount,
        distinctCount,
        duplicateCount: totalCount - distinctCount,
        nullCount,
        nullPercent:
          totalCount + nullCount > 0
            ? (nullCount / (totalCount + nullCount)) * 100
            : 0,
        avgLength: Number(row?.avg_len ?? 0),
      };
    }),
  );

  return summaries;
}

async function getTextDrilldown(
  table: string,
  column: string,
): Promise<TextDrilldown> {
  resolveTable(table);
  await validateColumn(table, column);
  const overview = await getOverview(table);
  const fieldRow = overview.rows.find((r) => r.columnName === column);
  const fieldCategory = fieldRow?.fieldCategory ?? "high-cardinality";

  const [statsRow] = await rawQuery<{
    distinct_count: number;
    total_count: number;
    avg_len: number;
    min_len: number;
    max_len: number;
    null_count: number;
  }>(
    `SELECT COUNT(DISTINCT \`${column}\`) AS distinct_count,
            COUNT(\`${column}\`) AS total_count,
            AVG(CHAR_LENGTH(\`${column}\`)) AS avg_len,
            MIN(CHAR_LENGTH(\`${column}\`)) AS min_len,
            MAX(CHAR_LENGTH(\`${column}\`)) AS max_len,
            COUNT(*) - COUNT(\`${column}\`) AS null_count
     FROM ${table}`,
  );

  const totalCount = Number(statsRow?.total_count ?? 0);
  const distinctCount = Number(statsRow?.distinct_count ?? 0);
  const nullCount = Number(statsRow?.null_count ?? 0);

  // Top 25 values
  const topRows = await rawQuery<{ value: string; cnt: number }>(
    `SELECT \`${column}\` AS value, COUNT(*) AS cnt
     FROM ${table}
     WHERE \`${column}\` IS NOT NULL AND \`${column}\` != ''
     GROUP BY \`${column}\`
     ORDER BY cnt DESC
     LIMIT 25`,
  );

  // Length distribution
  const lenRows = await rawQuery<{ len: number; cnt: number }>(
    `SELECT CHAR_LENGTH(\`${column}\`) AS len, COUNT(*) AS cnt
     FROM ${table}
     WHERE \`${column}\` IS NOT NULL AND \`${column}\` != ''
     GROUP BY len
     ORDER BY len`,
  );

  // TMK format conformance for identifier fields
  let formatConformance:
    | { pattern: string; matchCount: number; totalCount: number }
    | undefined;
  if (
    fieldCategory === "identifier" &&
    (column === "tmk" || column === "parent_tmk")
  ) {
    const [fmtRow] = await rawQuery<{ match_count: number }>(
      `SELECT COUNT(*) AS match_count FROM ${table}
       WHERE \`${column}\` REGEXP '^[1-4][0-9]{8}$'`,
    );
    formatConformance = {
      pattern: "^[1-4][0-9]{8}$",
      matchCount: Number(fmtRow?.match_count ?? 0),
      totalCount,
    };
  }

  return {
    columnName: column,
    label: columnLabel(table, column),
    fieldCategory: fieldCategory as FieldCategory,
    totalCount,
    distinctCount,
    duplicateCount: totalCount - distinctCount,
    nullCount,
    nullPercent:
      totalCount + nullCount > 0
        ? (nullCount / (totalCount + nullCount)) * 100
        : 0,
    avgLength: Number(statsRow?.avg_len ?? 0),
    minLength: Number(statsRow?.min_len ?? 0),
    maxLength: Number(statsRow?.max_len ?? 0),
    topValues: topRows.map((r) => ({
      value: String(r.value),
      count: Number(r.cnt),
    })),
    lengthDistribution: lenRows.map((r) => ({
      length: Number(r.len),
      count: Number(r.cnt),
    })),
    formatConformance,
  };
}

async function getTemporalSummaries(
  table: string,
): Promise<TemporalFieldSummary[]> {
  resolveTable(table);
  const overview = await getOverview(table);
  const dateFields = overview.rows.filter(
    (r) => r.fieldCategory === "date",
  );

  const summaries = await Promise.all(
    dateFields.map(async (field) => {
      const [statsRow] = await rawQuery<{
        min_date: string;
        max_date: string;
        null_count: number;
      }>(
        `SELECT MIN(\`${field.columnName}\`) AS min_date,
                MAX(\`${field.columnName}\`) AS max_date,
                COUNT(*) - COUNT(\`${field.columnName}\`) AS null_count
         FROM ${table}`,
      );

      const yearRows = await rawQuery<{ yr: number; cnt: number }>(
        `SELECT YEAR(\`${field.columnName}\`) AS yr, COUNT(*) AS cnt
         FROM ${table}
         WHERE \`${field.columnName}\` IS NOT NULL
         GROUP BY yr
         ORDER BY yr`,
      );

      return {
        columnName: field.columnName,
        label: field.label,
        minDate: statsRow?.min_date ? String(statsRow.min_date) : "",
        maxDate: statsRow?.max_date ? String(statsRow.max_date) : "",
        nullCount: Number(statsRow?.null_count ?? 0),
        yearCounts: yearRows.map((r) => ({
          year: Number(r.yr),
          count: Number(r.cnt),
        })),
      };
    }),
  );

  return summaries;
}

async function getTemporalDrilldown(
  table: string,
  column: string,
): Promise<TemporalDrilldown> {
  resolveTable(table);
  const colInfo = await validateColumn(table, column);

  const [statsRow] = await rawQuery<{
    min_date: string;
    max_date: string;
    null_count: number;
  }>(
    `SELECT MIN(\`${column}\`) AS min_date,
            MAX(\`${column}\`) AS max_date,
            COUNT(*) - COUNT(\`${column}\`) AS null_count
     FROM ${table}`,
  );

  // Annual counts
  const yearRows = await rawQuery<{ yr: number; cnt: number }>(
    `SELECT YEAR(\`${column}\`) AS yr, COUNT(*) AS cnt
     FROM ${table}
     WHERE \`${column}\` IS NOT NULL
     GROUP BY yr
     ORDER BY yr`,
  );

  const yearCounts = yearRows.map((r) => ({
    year: Number(r.yr),
    count: Number(r.cnt),
  }));

  // Monthly pattern for DATE/DATETIME
  let monthlyCounts: { month: number; count: number }[] | undefined;
  if (colInfo.dataType === "date" || colInfo.dataType === "datetime") {
    const monthRows = await rawQuery<{ mo: number; cnt: number }>(
      `SELECT MONTH(\`${column}\`) AS mo, COUNT(*) AS cnt
       FROM ${table}
       WHERE \`${column}\` IS NOT NULL
       GROUP BY mo
       ORDER BY mo`,
    );
    monthlyCounts = monthRows.map((r) => ({
      month: Number(r.mo),
      count: Number(r.cnt),
    }));
  }

  // Gap detection: find missing years in JS
  const gaps: number[] = [];
  if (yearCounts.length > 1) {
    const minYear = yearCounts[0].year;
    const maxYear = yearCounts[yearCounts.length - 1].year;
    const presentYears = new Set(yearCounts.map((y) => y.year));
    for (let y = minYear; y <= maxYear; y++) {
      if (!presentYears.has(y)) gaps.push(y);
    }
  }

  return {
    columnName: column,
    label: columnLabel(table, column),
    minDate: statsRow?.min_date ? String(statsRow.min_date) : "",
    maxDate: statsRow?.max_date ? String(statsRow.max_date) : "",
    nullCount: Number(statsRow?.null_count ?? 0),
    yearCounts,
    monthlyCounts,
    gaps,
  };
}

// ---------------------------------------------------------------------------
// Format helper
// ---------------------------------------------------------------------------

function formatBucketLabel(
  min: number,
  max: number,
  category: string,
): string {
  const fmt = (n: number) => {
    if (
      category === "large-dollar" ||
      category === "small-dollar"
    ) {
      if (n >= 1_000_000)
        return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
      if (n >= 1_000)
        return `$${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
      return `$${n.toLocaleString()}`;
    }
    return n.toLocaleString();
  };
  return `${fmt(min)} – ${fmt(max)}`;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const HhdbProfileCollection = {
  getColumnInfo,
  getOverview,
  getCategoricalSummaries,
  getCategoricalDrilldown,
  getNumericSummaries,
  getNumericDrilldown,
  getTextSummaries,
  getTextDrilldown,
  getTemporalSummaries,
  getTemporalDrilldown,
};

export default HhdbProfileCollection;
