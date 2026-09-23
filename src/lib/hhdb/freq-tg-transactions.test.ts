import { readFileSync } from "fs";
import path from "path";

import { describe, expect, test } from "bun:test";

import { TG_TRANSACTION_COLUMNS } from "@/core/catalog/models/hhdb-tg-transaction";
import { getSummaryFieldDefs } from "@/core/catalog/types/hhdb-data-dictionary";

const HHDB_DIR = __dirname;
const MAIN = path.join(HHDB_DIR, "hhdb-freq-tables.sql");
const MIGRATION = path.join(
  HHDB_DIR,
  "migrations/2026-09-22-freq-tg-transactions.sql",
);

/** column_name literals of the freq_tg_transactions INSERTs, per county_code kind. */
function insertedColumns(sql: string): { county: string[]; state: string[] } {
  const county: string[] = [];
  const state: string[] = [];
  const re =
    /INSERT INTO freq_tg_transactions \([^)]*\)\s*SELECT (LEFT\(tmk, 1\)|'0'), '([A-Za-z_0-9]+)',/g;
  for (const m of sql.matchAll(re)) {
    (m[1] === "'0'" ? state : county).push(m[2]);
  }
  return { county, state };
}

const summaryColumns = (getSummaryFieldDefs("tg_transactions") ?? []).map(
  (f) => f.column,
);
const dateColumns = TG_TRANSACTION_COLUMNS.filter(
  (c) => c.kind === "date" && c.summary,
).map((c) => c.column);

describe("freq_tg_transactions mirrors the other freq_ tables", () => {
  test("the dictionary exposes a Summary tab for tg_transactions", () => {
    expect(summaryColumns.length).toBeGreaterThan(0);
    expect(dateColumns.length).toBeGreaterThan(0);
  });

  for (const [name, file] of [
    ["hhdb-freq-tables.sql", MAIN],
    ["the standalone migration", MIGRATION],
  ] as const) {
    const sql = readFileSync(file, "utf8");

    test(`${name}: one county + one state INSERT per Summary-tab field, no more, no fewer`, () => {
      const { county, state } = insertedColumns(sql);
      // If this fails you toggled `summary` on a TG_TRANSACTION_COLUMNS spec:
      // regenerate the two INSERTs for it in BOTH sql files.
      expect(county).toEqual(summaryColumns);
      expect(state).toEqual(summaryColumns);
    });

    test(`${name}: per-county INSERTs keep only real county digits`, () => {
      const countyInserts = sql.match(
        /SELECT LEFT\(tmk, 1\), '[A-Za-z_0-9]+',[^;]*FROM tg_transactions[^;]*;/g,
      );
      expect(countyInserts?.length).toBe(summaryColumns.length);
      for (const stmt of countyInserts ?? []) {
        expect(stmt).toContain("WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4')");
      }
    });

    test(`${name}: date columns are counted by year, everything else by value`, () => {
      const stmts = sql.match(
        /SELECT (?:LEFT\(tmk, 1\)|'0'), '([A-Za-z_0-9]+)',[^;]*FROM tg_transactions[^;]*;/g,
      );
      expect(stmts?.length).toBe(summaryColumns.length * 2);
      for (const stmt of stmts ?? []) {
        const col = stmt.match(/, '([A-Za-z_0-9]+)',/)![1];
        const byYear = stmt.includes(`CAST(YEAR(\`${col}\`) AS CHAR)`);
        expect(`${col}: ${byYear}`).toBe(
          `${col}: ${dateColumns.includes(col)}`,
        );
      }
    });
  }

  test("the main file drops, creates and regenerates it inside the shared procedure", () => {
    const sql = readFileSync(MAIN, "utf8");
    expect(sql).toContain("DROP TABLE IF EXISTS freq_tg_transactions;");
    expect(sql).toContain("CREATE TABLE freq_tg_transactions (");
    const proc = sql.slice(
      sql.indexOf("CREATE PROCEDURE sp_regenerate_freq_tables()"),
      sql.indexOf("END //"),
    );
    expect(proc).toContain("TRUNCATE TABLE freq_tg_transactions;");
    expect(insertedColumns(proc).county).toEqual(summaryColumns);
  });

  test("the migration touches nothing but freq_tg_transactions", () => {
    const sql = readFileSync(MIGRATION, "utf8")
      .split("\n")
      .filter((l) => !l.startsWith("--"))
      .join("\n");
    expect(sql).not.toMatch(/\bDROP\b/i);
    const tables = [
      ...sql.matchAll(/\b(?:INTO|TABLE(?: IF NOT EXISTS)?)\s+`?(\w+)`?/g),
    ].map((m) => m[1]);
    expect(new Set(tables)).toEqual(new Set(["freq_tg_transactions"]));
  });
});
