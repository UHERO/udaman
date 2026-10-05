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
 */
export function freqInsertStatements(
  table: string,
  dateColumns: ReadonlySet<string>,
): string[] {
  const fields = getSummaryFieldDefs(table);
  if (!fields) throw new Error(`No Summary-tab fields for ${table}`);
  const freq = `freq_${table}`;
  return fields.flatMap(({ column: c }) => {
    const v = dateColumns.has(c) ? `YEAR(\`${c}\`)` : `\`${c}\``;
    return [
      `INSERT INTO ${freq} (county_code, column_name, column_value, frequency)\n` +
        `SELECT LEFT(tmk, 1), '${c}', LEFT(COALESCE(CAST(${v} AS CHAR), '[NULL]'), 500), COUNT(*)\n` +
        `FROM ${table} WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(${v} AS CHAR), 500);`,
      `INSERT INTO ${freq} (county_code, column_name, column_value, frequency)\n` +
        `SELECT '0', '${c}', LEFT(COALESCE(CAST(${v} AS CHAR), '[NULL]'), 500), COUNT(*)\n` +
        `FROM ${table} GROUP BY LEFT(CAST(${v} AS CHAR), 500);`,
    ];
  });
}

/** Whitespace-normalized freq INSERTs found in a .sql file, for comparison. */
export function freqInsertsInSql(sql: string, table: string): string[] {
  const re = new RegExp(`INSERT INTO freq_${table} \\([^;]*;`, "g");
  return [...sql.matchAll(re)].map((m) => m[0].replace(/\s+/g, " "));
}
