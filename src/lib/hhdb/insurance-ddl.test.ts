/**
 * Guards the contract between the insurance_* DDL and
 * src/core/crawlers/ficoh/columns.ts, that the hand-applied migration is the
 * canonical DDL verbatim, and that the tables are durable (never part of the
 * qpub rebuild's drop-and-recreate set).
 */
import { readFileSync } from "fs";
import path from "path";

import { describe, expect, test } from "bun:test";

import {
  CLAIM_COLUMNS,
  CLAIM_INSERT_COLUMNS,
  POLICY_COLUMNS,
  POLICY_INSERT_COLUMNS,
  type FicohColumnSpec,
} from "@/core/crawlers/ficoh/columns";
import { ALL_DATA_TABLES } from "@/core/workers/processors/qpub-db-sync";

const HHDB_DIR = path.resolve(import.meta.dir);
const CANONICAL = readFileSync(path.join(HHDB_DIR, "insurance.sql"), "utf8");
const MIGRATION = readFileSync(
  path.join(HHDB_DIR, "migrations/2026-10-05-create-insurance-tables.sql"),
  "utf8",
);
const TABLES = ["insurance_policies", "insurance_claims", "insurance_loads"];

const stripComments = (sql: string) =>
  sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

function createStatement(sql: string, table: string): string {
  const m = stripComments(sql).match(
    new RegExp(
      "CREATE TABLE IF NOT EXISTS `" + table + "` \\([\\s\\S]*?\\n\\)[^;]*;",
    ),
  );
  if (!m) throw new Error(`No CREATE TABLE for ${table}`);
  return m[0];
}

/** Column name → type text (comment removed), in DDL order. */
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

const KIND_TYPE: Record<FicohColumnSpec["kind"], RegExp> = {
  text: /^(CHAR|VARCHAR)\(\d+\)/,
  int: /^(TINYINT|SMALLINT|INT)\b/,
  money: /^DECIMAL\(\d+,2\)/,
  excelDate: /^DATE\b/,
  ymdDate: /^DATE\b/,
  zip: /^VARCHAR\(10\)/,
};

function checkSpecs(
  cols: Map<string, string>,
  specs: readonly FicohColumnSpec[],
) {
  for (const spec of specs) {
    const type = cols.get(spec.column) ?? "";
    const ok =
      KIND_TYPE[spec.kind].test(type) &&
      (spec.required
        ? type.endsWith("NOT NULL") || type.includes("PRIMARY KEY")
        : type.endsWith(" NULL") && !type.endsWith("NOT NULL"));
    expect(`${spec.column}: ${type} → ${ok}`).toBe(
      `${spec.column}: ${type} → true`,
    );
  }
}

describe("insurance.sql", () => {
  const policies = parseColumns(
    createStatement(CANONICAL, "insurance_policies"),
  );
  const claims = parseColumns(createStatement(CANONICAL, "insurance_claims"));

  test("columns are exactly the loader's insert lists, in order", () => {
    expect([...policies.keys()]).toEqual(POLICY_INSERT_COLUMNS);
    expect([...claims.keys()]).toEqual(CLAIM_INSERT_COLUMNS);
  });

  test("every data column's SQL type matches its kind and nullability", () => {
    checkSpecs(policies, POLICY_COLUMNS);
    checkSpecs(claims, CLAIM_COLUMNS);
    expect(policies.get("id")).toBe("INT UNSIGNED NOT NULL PRIMARY KEY");
    expect(claims.get("claim_number")).toBe("VARCHAR(16) NOT NULL PRIMARY KEY");
    // tmk holds CPR-level TMKs as properties.tmk stores them.
    expect(policies.get("tmk")).toBe("VARCHAR(30) NULL");
    expect(claims.get("tmk")).toBe("VARCHAR(30) NULL");
  });

  test("one row per policy term x location", () => {
    expect(createStatement(CANONICAL, "insurance_policies")).toContain(
      "UNIQUE KEY `uq_policy_term_location` (`policy_number`, `effective_date`, `location_no`)",
    );
  });

  test("the migration is the canonical DDL verbatim", () => {
    expect(stripComments(MIGRATION).trimStart()).toBe(
      stripComments(CANONICAL).trimStart(),
    );
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
