import { getSummaryFieldDefs } from "../types/hhdb-data-dictionary";

/**
 * The INSERTs that fill `freq_<table>` from the table's Summary-tab fields
 * (the data dictionary) — the same statements hhdb-freq-tables.sql and the
 * standalone freq migrations contain, generated rather than parsed so the
 * loaders that refresh their own freq tables after a load cannot drift from
 * the files (freq-*.test.ts compare them).
 *
 * Per-county INSERTs skip rows with no TMK (county_code is NOT NULL); those
 * count toward '0' (State) only. Date columns are counted by year.
 *
 * Tables listed in FREQ_MONTH_COLUMNS also get month counts of those date
 * columns, under column_name `<column>_month` ("YYYY-MM") — not a Summary-tab
 * field, but what the Exploration tab's monthly coverage chart reads.
 */
export const FREQ_MONTH_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  renthub_listings: ["scraped_at", "date_posted"],
};

/** freq_ column_name of a date column's month counts. */
export const monthFreqColumn = (column: string) => `${column}_month`;

/** The extra (non-Summary) column_names a table's freq_ holds. */
export function extraFreqColumns(table: string): string[] {
  return (FREQ_MONTH_COLUMNS[table] ?? []).map(monthFreqColumn);
}

function pair(table: string, name: string, expr: string): string[] {
  const freq = `freq_${table}`;
  return [
    `INSERT INTO ${freq} (county_code, column_name, column_value, frequency)\n` +
      `SELECT LEFT(tmk, 1), '${name}', LEFT(COALESCE(CAST(${expr} AS CHAR), '[NULL]'), 500), COUNT(*)\n` +
      `FROM ${table} WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(${expr} AS CHAR), 500);`,
    `INSERT INTO ${freq} (county_code, column_name, column_value, frequency)\n` +
      `SELECT '0', '${name}', LEFT(COALESCE(CAST(${expr} AS CHAR), '[NULL]'), 500), COUNT(*)\n` +
      `FROM ${table} GROUP BY LEFT(CAST(${expr} AS CHAR), 500);`,
  ];
}

export function freqInsertStatements(
  table: string,
  dateColumns: ReadonlySet<string>,
): string[] {
  const fields = getSummaryFieldDefs(table);
  if (!fields) throw new Error(`No Summary-tab fields for ${table}`);
  return [
    ...fields.flatMap(({ column: c }) =>
      pair(table, c, dateColumns.has(c) ? `YEAR(\`${c}\`)` : `\`${c}\``),
    ),
    ...(FREQ_MONTH_COLUMNS[table] ?? []).flatMap((c) =>
      pair(table, monthFreqColumn(c), `DATE_FORMAT(\`${c}\`, '%Y-%m')`),
    ),
  ];
}

/** Whitespace-normalized freq INSERTs found in a .sql file, for comparison. */
export function freqInsertsInSql(sql: string, table: string): string[] {
  const re = new RegExp(`INSERT INTO freq_${table} \\([^;]*;`, "g");
  return [...sql.matchAll(re)].map((m) => m[0].replace(/\s+/g, " "));
}
