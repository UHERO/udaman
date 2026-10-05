import { readFileSync } from "fs";
import path from "path";

import { describe, expect, test } from "bun:test";

import { getSummaryFieldDefs } from "@/core/catalog/types/hhdb-data-dictionary";
import {
  freqInsertsInSql,
  freqInsertStatements,
} from "@/core/catalog/utils/hhdb-freq-sql";
import {
  RENTHUB_COLUMNS,
  RENTHUB_INSERT_COLUMNS,
} from "@/core/crawlers/renthub/columns";

const HHDB_DIR = __dirname;
const MAIN = path.join(HHDB_DIR, "hhdb-freq-tables.sql");
const MIGRATION = path.join(
  HHDB_DIR,
  "migrations/2026-10-05-freq-renthub-listings.sql",
);

/** column_name literals of the freq_renthub_listings INSERTs, per county_code kind. */
function insertedColumns(sql: string): { county: string[]; state: string[] } {
  const county: string[] = [];
  const state: string[] = [];
  const re =
    /INSERT INTO freq_renthub_listings \([^)]*\)\s*SELECT (LEFT\(tmk, 1\)|'0'), '([a-z_0-9]+)',/g;
  for (const m of sql.matchAll(re)) {
    (m[1] === "'0'" ? state : county).push(m[2]);
  }
  return { county, state };
}

const summaryColumns = (getSummaryFieldDefs("renthub_listings") ?? []).map(
  (f) => f.column,
);
const dateColumns = RENTHUB_COLUMNS.filter(
  (c) => (c.kind === "date" || c.kind === "datetime") && c.summary,
).map((c) => c.column);

describe("freq_renthub_listings mirrors the other freq_ tables", () => {
  test("the dictionary has a Summary tab for renthub_listings, on real columns", () => {
    expect(summaryColumns.length).toBeGreaterThan(0);
    for (const c of summaryColumns) expect(RENTHUB_INSERT_COLUMNS).toContain(c);
    // Free text and near-unique values are never counted.
    for (const c of ["id", "address", "description", "latitude", "longitude"])
      expect(summaryColumns).not.toContain(c);
  });

  for (const [name, file] of [
    ["hhdb-freq-tables.sql", MAIN],
    ["the standalone migration", MIGRATION],
  ] as const) {
    const sql = readFileSync(file, "utf8");

    test(`${name}: one county + one state INSERT per Summary-tab field, no more, no fewer`, () => {
      const { county, state } = insertedColumns(sql);
      // If this fails you toggled `summary` on a RENTHUB_COLUMNS spec or a
      // renthub_listings dictionary entry: regenerate the two INSERTs for it
      // in BOTH sql files.
      expect(county).toEqual(summaryColumns);
      expect(state).toEqual(summaryColumns);
    });

    test(`${name}: INSERTs are exactly what the loader runs after a load`, () => {
      expect(freqInsertsInSql(sql, "renthub_listings")).toEqual(
        freqInsertStatements("renthub_listings", new Set(dateColumns)).map(
          (q) => q.replace(/\s+/g, " "),
        ),
      );
    });

    test(`${name}: per-county INSERTs skip listings without a TMK`, () => {
      const countyInserts = sql.match(
        /SELECT LEFT\(tmk, 1\), '[a-z_0-9]+',[^;]*FROM renthub_listings[^;]*;/g,
      );
      expect(countyInserts?.length).toBe(summaryColumns.length);
      for (const stmt of countyInserts ?? [])
        expect(stmt).toContain("WHERE tmk IS NOT NULL");
    });

    test(`${name}: date columns are counted by year, everything else by value`, () => {
      const stmts = sql.match(
        /SELECT (?:LEFT\(tmk, 1\)|'0'), '([a-z_0-9]+)',[^;]*FROM renthub_listings[^;]*;/g,
      );
      expect(stmts?.length).toBe(summaryColumns.length * 2);
      for (const stmt of stmts ?? []) {
        const col = stmt.match(/, '([a-z_0-9]+)',/)![1];
        const byYear = stmt.includes(`CAST(YEAR(\`${col}\`) AS CHAR)`);
        expect(`${col}: ${byYear}`).toBe(
          `${col}: ${dateColumns.includes(col)}`,
        );
      }
    });
  }

  test("the main file drops, creates and regenerates it inside the shared procedure", () => {
    const sql = readFileSync(MAIN, "utf8");
    expect(sql).toContain("DROP TABLE IF EXISTS freq_renthub_listings;");
    expect(sql).toContain("CREATE TABLE freq_renthub_listings (");
    const proc = sql.slice(
      sql.indexOf("CREATE PROCEDURE sp_regenerate_freq_tables()"),
      sql.indexOf("END //"),
    );
    expect(proc).toContain("TRUNCATE TABLE freq_renthub_listings;");
  });

  test("the migration touches nothing but freq_renthub_listings", () => {
    const sql = readFileSync(MIGRATION, "utf8")
      .split("\n")
      .filter((l) => !l.startsWith("--"))
      .join("\n");
    expect(sql).not.toMatch(/\bDROP\b/i);
    const tables = [
      ...sql.matchAll(/\b(?:INTO|TABLE(?: IF NOT EXISTS)?)\s+`?(\w+)`?/g),
    ].map((m) => m[1]);
    expect(new Set(tables)).toEqual(new Set(["freq_renthub_listings"]));
  });
});
