/**
 * Guards the contract between the renthub_listings DDL and
 * src/core/crawlers/renthub/columns.ts, that the hand-applied migration is the
 * canonical DDL verbatim, and the rule that the RentHub tables are durable
 * (never part of the qpub rebuild's drop-and-recreate set).
 */
import { readFileSync } from "fs";
import path from "path";

import { describe, expect, test } from "bun:test";

import {
  RENTHUB_COLUMNS,
  RENTHUB_INSERT_COLUMNS,
  type RenthubColumnSpec,
} from "@/core/crawlers/renthub/columns";
import { ALL_DATA_TABLES } from "@/core/workers/processors/qpub-db-sync";

const HHDB_DIR = path.resolve(import.meta.dir);
const CANONICAL = readFileSync(
  path.join(HHDB_DIR, "renthub_listings.sql"),
  "utf8",
);
const MIGRATION = readFileSync(
  path.join(HHDB_DIR, "migrations/2026-10-05-create-renthub-listings.sql"),
  "utf8",
);
const TABLES = ["renthub_listings", "renthub_loads"];

/** File with `-- …` comment lines removed (full-line comments only). */
const stripComments = (sql: string) =>
  sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

/** The SQL alone: comments removed, leading blank lines trimmed. */
const ddlBody = (sql: string) => stripComments(sql).trimStart();

function createStatement(sql: string, table: string): string {
  const m = stripComments(sql).match(
    new RegExp(
      "CREATE TABLE IF NOT EXISTS `" + table + "` \\([\\s\\S]*?\\n\\)[^;]*;",
    ),
  );
  if (!m) throw new Error(`No CREATE TABLE for ${table}`);
  return m[0];
}

/** Column name → type text (everything after the name, comment removed). */
function parseColumns(statement: string): Map<string, string> {
  const cols = new Map<string, string>();
  for (const line of statement.split("\n")) {
    const m = line.match(/^\s+`([a-z0-9_]+)`\s+(.+?),?\s*$/);
    if (!m) continue;
    cols.set(
      m[1],
      m[2]
        .replace(/\s+COMMENT\s+'(?:[^']|'')*'/, "")
        .replace(/,$/, "")
        .trim(),
    );
  }
  return cols;
}

/** SQL base type each kind must use (sizes are the DDL's call). */
const KIND_TYPE: Record<RenthubColumnSpec["kind"], RegExp> = {
  text: /^(CHAR|VARCHAR)\(\d+\)|^MEDIUMTEXT\b/,
  int: /^(TINYINT|SMALLINT|INT) UNSIGNED\b/,
  decimal: /^DECIMAL\(\d+,\d+\)/,
  flag: /^BOOLEAN\b/,
  date: /^DATE\b/,
  datetime: /^DATETIME\(3\)/,
};

describe("renthub_listings.sql", () => {
  const cols = parseColumns(createStatement(CANONICAL, "renthub_listings"));

  test("columns are exactly the loader's insert list, in order", () => {
    expect([...cols.keys()]).toEqual(RENTHUB_INSERT_COLUMNS);
  });

  test("every data column's SQL type matches its kind and nullability", () => {
    for (const spec of RENTHUB_COLUMNS) {
      const type = cols.get(spec.column) ?? "";
      const ok =
        KIND_TYPE[spec.kind].test(type) &&
        type.endsWith(spec.required ? "NOT NULL" : " NULL") &&
        (spec.required || !type.endsWith("NOT NULL"));
      expect(`${spec.column}: ${type} → ${ok}`).toBe(
        `${spec.column}: ${type} → true`,
      );
    }
    expect(cols.get("id")).toBe("INT UNSIGNED NOT NULL PRIMARY KEY");
    expect(cols.get("batch")).toBe("VARCHAR(21) NOT NULL");
    expect(cols.get("tmk")).toBe("VARCHAR(18) NULL");
    expect(cols.get("tmk_match")).toBe("VARCHAR(16) NULL");
    expect(cols.get("tmk_address")).toBe("VARCHAR(255) NULL");
    expect(cols.get("tmk_distance_m")).toBe("DECIMAL(6,1) NULL");
    expect(cols.get("coord_decimals")).toBe("TINYINT UNSIGNED NULL");
  });

  test("the migration is the canonical DDL verbatim", () => {
    expect(ddlBody(MIGRATION)).toBe(ddlBody(CANONICAL));
  });

  test("tables are durable: no DROP, not rebuilt by qpub sync", () => {
    for (const sql of [CANONICAL, MIGRATION])
      expect(stripComments(sql)).not.toMatch(/DROP\s+TABLE/i);
    for (const t of TABLES) {
      expect(createStatement(CANONICAL, t)).toContain("utf8mb4");
      expect(ALL_DATA_TABLES).not.toContain(t);
    }
  });
});
