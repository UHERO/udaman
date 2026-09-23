/**
 * Guards the contract between the tg_transactions DDL and the read model
 * (src/core/catalog/models/hhdb-tg-transaction.ts), the index assumptions the
 * app's queries make, and the rule that the table is durable (never part of
 * the qpub rebuild's drop-and-recreate set).
 */
import { readFileSync } from "fs";
import path from "path";

import { describe, expect, test } from "bun:test";

import {
  TG_SORTABLE_COLUMNS,
  TG_TRANSACTION_COLUMNS,
} from "@/core/catalog/models/hhdb-tg-transaction";
import { ALL_DATA_TABLES } from "@/core/workers/processors/qpub-db-sync";

const HHDB_DIR = path.resolve(import.meta.dir);
const DDL = readFileSync(path.join(HHDB_DIR, "tg_transactions.sql"), "utf8");

/** File with `-- …` comment lines removed (full-line comments only). */
const stripComments = (sql: string) =>
  sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

const statement = (() => {
  const m = stripComments(DDL).match(
    /CREATE TABLE IF NOT EXISTS `tg_transactions` \([\s\S]*?\n\)[^;]*;/,
  );
  if (!m) throw new Error("No CREATE TABLE for tg_transactions");
  return m[0];
})();

/** Column name → type text, in DDL order. */
const columns = new Map<string, string>();
for (const line of statement.split("\n")) {
  const m = line.match(/^\s+`([A-Za-z0-9_]+)`\s+(.+?),?\s*$/);
  if (m) columns.set(m[1], m[2].replace(/,$/, "").trim());
}

/** index name → column list. */
const indexes = new Map<string, string[]>();
for (const m of statement.matchAll(/INDEX `([a-z_A-Z]+)` \(([^)]+)\)/g)) {
  indexes.set(
    m[1],
    m[2].split(",").map((c) => c.trim().replace(/`/g, "")),
  );
}

describe("tg_transactions.sql", () => {
  test("column set and order match the read model", () => {
    expect([...columns.keys()]).toEqual(
      TG_TRANSACTION_COLUMNS.map((c) => c.column),
    );
  });

  test("every column's SQL type agrees with its model kind", () => {
    for (const spec of TG_TRANSACTION_COLUMNS) {
      const type = columns.get(spec.column) ?? "";
      const expected =
        spec.kind === "date"
          ? /^DATE\b/
          : spec.kind === "text"
            ? /^VARCHAR\(\d+\)/
            : /^(INT|BIGINT)\b/;
      expect(`${spec.column}: ${type} → ${expected.test(type)}`).toBe(
        `${spec.column}: ${type} → true`,
      );
    }
    expect(columns.get("id")).toBe("INT NOT NULL");
  });

  test("every sortable / searchable column has a single-column index", () => {
    const singles = new Set(
      [...indexes.values()].filter((c) => c.length === 1).map((c) => c[0]),
    );
    singles.add("id");
    for (const col of TG_SORTABLE_COLUMNS) {
      expect(`${col}: ${singles.has(col)}`).toBe(`${col}: true`);
    }
  });

  test("the out-of-state covering index carries all five columns", () => {
    // The Exploration tab reads mailingState / mailingZipCode / mailingCity
    // from this index; a reload that drops any of them makes the queries
    // fall back to hundreds of thousands of row lookups (2026-09-22).
    expect(indexes.get("idx_tg_out_of_state")).toEqual([
      "conveyanceAmount",
      "recDate",
      "mailingState",
      "mailingZipCode",
      "mailingCity",
    ]);
  });

  test("the file cannot drop or truncate anything", () => {
    expect(stripComments(DDL)).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i);
  });

  test("the table is not part of the qpub rebuild", () => {
    const schema = readFileSync(path.join(HHDB_DIR, "hhdb-schema.sql"), "utf8");
    expect(schema).not.toContain("tg_transactions");
    expect(ALL_DATA_TABLES).not.toContain("tg_transactions");
  });
});
