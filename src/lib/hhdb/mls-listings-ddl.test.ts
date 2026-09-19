/**
 * Guards the contract between the mls_listings DDL and
 * src/core/crawlers/mls/columns.ts, and the rule that the MLS tables are
 * durable (never part of the qpub rebuild's drop-and-recreate set).
 */
import { readFileSync } from "fs";
import path from "path";

import { describe, expect, test } from "bun:test";

import {
  MLS_COLUMN_NAMES,
  MLS_COLUMNS,
  MLS_LOADER_COLUMNS,
  type MlsColumnSpec,
} from "@/core/crawlers/mls/columns";
import { ALL_DATA_TABLES } from "@/core/workers/processors/qpub-db-sync";

const HHDB_DIR = path.resolve(import.meta.dir);
const CANONICAL = path.join(HHDB_DIR, "mls_listings.sql");
const MIGRATION = path.join(
  HHDB_DIR,
  "migrations/2026-09-18-create-mls-listings.sql",
);
const TABLES = ["mls_listings", "mls_listing_history"];

const read = (p: string) => readFileSync(p, "utf8");

/** File with `-- …` comment lines removed (full-line comments only). */
const stripComments = (sql: string) =>
  sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

/** The full `CREATE TABLE … ;` statement for a table. */
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
    if (cols.has(m[1])) throw new Error(`Duplicate column ${m[1]}`);
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

function expectedType(spec: MlsColumnSpec): string {
  switch (spec.kind) {
    case "text":
      return spec.length ? `VARCHAR(${spec.length}) NULL` : "TEXT NULL";
    case "int":
      return "INT NULL";
    case "money":
      return "BIGINT NULL";
    case "date":
      return "DATE NULL";
    case "year":
      return "SMALLINT NULL";
  }
}

describe("mls_listings.sql", () => {
  const stmt = createStatement(read(CANONICAL), "mls_listings");
  const cols = parseColumns(stmt);

  test("column set is exactly MLS_LOADER_COLUMNS ∪ MLS_COLUMN_NAMES", () => {
    const expected = [...MLS_LOADER_COLUMNS, ...MLS_COLUMN_NAMES];
    expect(new Set(expected).size).toBe(expected.length);
    expect([...cols.keys()].sort()).toEqual([...expected].sort());
  });

  test("data columns appear in MLS_COLUMNS order", () => {
    const names = [...cols.keys()];
    const start = names.indexOf(MLS_COLUMN_NAMES[0]);
    expect(names.slice(start, start + MLS_COLUMN_NAMES.length)).toEqual(
      MLS_COLUMN_NAMES,
    );
  });

  test("every data column's SQL type matches its kind and is NULLable", () => {
    for (const spec of MLS_COLUMNS) {
      expect(`${spec.column}: ${cols.get(spec.column)}`).toBe(
        `${spec.column}: ${expectedType(spec)}`,
      );
    }
  });

  test("loader-owned columns have the agreed types", () => {
    const expected: Record<(typeof MLS_LOADER_COLUMNS)[number], string> = {
      id: "INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      mls_board: "VARCHAR(8) NOT NULL",
      mls_number: "VARCHAR(16) NOT NULL",
      source_site: "VARCHAR(32) NOT NULL",
      source_priority: "SMALLINT NOT NULL DEFAULT 0",
      source_url: "VARCHAR(512) NULL",
      status: "VARCHAR(32) NOT NULL",
      status_raw: "VARCHAR(64) NULL",
      extra: "JSON NULL",
      html_path: "VARCHAR(512) NULL",
      first_seen_at: "DATETIME NULL",
      last_seen_at: "DATETIME NULL",
      fetched_at: "DATETIME NULL",
      parsed_at: "DATETIME NULL",
    };
    for (const [c, t] of Object.entries(expected))
      expect(`${c}: ${cols.get(c)}`).toBe(`${c}: ${t}`);
  });

  test("keys and table options", () => {
    expect(stmt).toContain(
      "UNIQUE KEY `uq_mls_board_number` (`mls_board`, `mls_number`)",
    );
    for (const idx of [
      "(`tmk`)",
      "(`island`, `status`)",
      "(`list_date`)",
      "(`date_sold`)",
      "(`status`, `last_seen_at`)",
    ]) {
      expect(stmt).toMatch(
        new RegExp("INDEX `[a-z_]+` " + idx.replace(/[()]/g, "\\$&")),
      );
    }
    expect(stmt).toContain("ENGINE = InnoDB");
    expect(stmt).toContain("CHARSET = utf8mb4");
  });

  test("every identifier in the column / key definitions is backtick-quoted", () => {
    for (const line of stmt.split("\n").slice(1)) {
      if (
        /^\s*$/.test(line) ||
        /^\)|^\s+(DEFAULT|COLLATE|COMMENT)\b/.test(line)
      )
        continue;
      expect(line).toMatch(/^\s+(`[a-z0-9_]+`|UNIQUE KEY `|INDEX `)/);
    }
  });
});

describe("mls_listing_history", () => {
  const cols = parseColumns(
    createStatement(read(CANONICAL), "mls_listing_history"),
  );

  test("columns and types", () => {
    expect(Object.fromEntries(cols)).toEqual({
      id: "INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      mls_board: "VARCHAR(8) NOT NULL",
      mls_number: "VARCHAR(16) NOT NULL",
      observed_at: "DATETIME NOT NULL",
      status: "VARCHAR(32) NOT NULL",
      list_price: "BIGINT NULL",
      sold_price: "BIGINT NULL",
      source_site: "VARCHAR(32) NOT NULL",
      change_type: "VARCHAR(32) NOT NULL",
    });
  });

  test("timeline index", () => {
    expect(createStatement(read(CANONICAL), "mls_listing_history")).toContain(
      "(`mls_board`, `mls_number`, `observed_at`)",
    );
  });
});

describe("migration + durability", () => {
  test("migration DDL is identical to the canonical file", () => {
    for (const t of TABLES) {
      expect(createStatement(read(MIGRATION), t)).toBe(
        createStatement(read(CANONICAL), t),
      );
    }
  });

  test("neither file can drop or truncate anything", () => {
    for (const f of [CANONICAL, MIGRATION]) {
      expect(stripComments(read(f))).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i);
    }
  });

  test("the MLS tables are not part of the qpub rebuild", () => {
    const schema = read(path.join(HHDB_DIR, "hhdb-schema.sql"));
    for (const t of TABLES) {
      expect(schema).not.toContain(t);
      expect(ALL_DATA_TABLES).not.toContain(t);
    }
    // Belt and braces: the source text too, in case the list is ever built dynamically.
    const syncSrc = read(
      path.resolve(HHDB_DIR, "../../core/workers/processors/qpub-db-sync.ts"),
    );
    expect(syncSrc).not.toMatch(/mls_listing/);
  });
});
