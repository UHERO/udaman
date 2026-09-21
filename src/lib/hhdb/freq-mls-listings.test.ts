import { readFileSync } from "fs";
import path from "path";

import { describe, expect, test } from "bun:test";

import { getSummaryFieldDefs } from "@/core/catalog/types/hhdb-data-dictionary";

const HHDB_DIR = __dirname;
const MAIN = path.join(HHDB_DIR, "hhdb-freq-tables.sql");
const MIGRATION = path.join(
  HHDB_DIR,
  "migrations/2026-09-21-freq-mls-listings.sql",
);

/** column_name literals of the freq_mls_listings INSERTs, per county_code kind. */
function insertedColumns(sql: string): { county: string[]; state: string[] } {
  const county: string[] = [];
  const state: string[] = [];
  const re =
    /INSERT INTO freq_mls_listings \([^)]*\)\s*SELECT (LEFT\(tmk, 1\)|'0'), '([a-z_0-9]+)',/g;
  for (const m of sql.matchAll(re)) {
    (m[1] === "'0'" ? state : county).push(m[2]);
  }
  return { county, state };
}

const summaryColumns = (getSummaryFieldDefs("mls_listings") ?? []).map(
  (f) => f.column,
);

describe("freq_mls_listings mirrors the other freq_ tables", () => {
  for (const [name, file] of [
    ["hhdb-freq-tables.sql", MAIN],
    ["the standalone migration", MIGRATION],
  ] as const) {
    test(`${name}: one county + one state INSERT per Summary-tab field, no more, no fewer`, () => {
      const { county, state } = insertedColumns(readFileSync(file, "utf8"));
      // If this fails you added / removed a `summary` field on mls_listings in
      // the data dictionary: add / remove its two INSERTs in BOTH sql files.
      expect(county).toEqual(summaryColumns);
      expect(state).toEqual(summaryColumns);
    });
  }

  test("per-county INSERTs skip listings without a TMK (county_code is NOT NULL)", () => {
    const sql = readFileSync(MAIN, "utf8");
    const countyInserts = sql.match(
      /SELECT LEFT\(tmk, 1\), '[a-z_0-9]+',[^;]*FROM mls_listings[^;]*;/g,
    );
    expect(countyInserts?.length).toBe(summaryColumns.length);
    for (const stmt of countyInserts ?? []) {
      expect(stmt).toContain("WHERE tmk IS NOT NULL");
    }
  });

  test("the main file drops, creates and regenerates it inside the shared procedure", () => {
    const sql = readFileSync(MAIN, "utf8");
    expect(sql).toContain("DROP TABLE IF EXISTS freq_mls_listings;");
    expect(sql).toContain("CREATE TABLE freq_mls_listings (");
    const proc = sql.slice(
      sql.indexOf("CREATE PROCEDURE sp_regenerate_freq_tables()"),
      sql.indexOf("END //"),
    );
    expect(proc).toContain("TRUNCATE TABLE freq_mls_listings;");
  });

  test("the migration touches nothing but freq_mls_listings", () => {
    const sql = readFileSync(MIGRATION, "utf8")
      .split("\n")
      .filter((l) => !l.startsWith("--"))
      .join("\n");
    expect(sql).not.toMatch(/\bDROP\b/i);
    const tables = [
      ...sql.matchAll(/\b(?:INTO|TABLE(?: IF NOT EXISTS)?)\s+`?(\w+)`?/g),
    ].map((m) => m[1]);
    expect(new Set(tables)).toEqual(new Set(["freq_mls_listings"]));
  });

  test("the UI has a single frequency pattern — nothing computed live", () => {
    const src = readFileSync(
      path.resolve(
        HHDB_DIR,
        "../../core/catalog/collections/hhdb-summary-collection.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/LIVE_FREQ|liveFreq/);
  });
});
