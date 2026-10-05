import { readFileSync } from "fs";
import path from "path";

import { describe, expect, test } from "bun:test";

import { getSummaryFieldDefs } from "@/core/catalog/types/hhdb-data-dictionary";
import {
  freqInsertsInSql,
  freqInsertStatements,
} from "@/core/catalog/utils/hhdb-freq-sql";
import {
  CLAIM_COLUMNS,
  CLAIM_INSERT_COLUMNS,
  POLICY_COLUMNS,
  POLICY_INSERT_COLUMNS,
  type FicohColumnSpec,
} from "@/core/crawlers/ficoh/columns";

const HHDB_DIR = __dirname;
const MAIN = path.join(HHDB_DIR, "hhdb-freq-tables.sql");
const MIGRATION = path.join(
  HHDB_DIR,
  "migrations/2026-10-05-freq-insurance.sql",
);

const TABLES: {
  table: string;
  columns: string[];
  specs: readonly FicohColumnSpec[];
  identifying: string[];
}[] = [
  {
    table: "insurance_policies",
    columns: POLICY_INSERT_COLUMNS,
    specs: POLICY_COLUMNS,
    identifying: [
      "id",
      "policy_number",
      "policy_base",
      "address",
      "tmk",
      "tmk_address",
    ],
  },
  {
    table: "insurance_claims",
    columns: CLAIM_INSERT_COLUMNS,
    specs: CLAIM_COLUMNS,
    identifying: [
      "claim_number",
      "policy_number",
      "policy_id",
      "loss_address",
      "tmk",
      "tmk_address",
    ],
  },
];

/** column_name literals of a freq table's INSERTs, per county_code kind. */
function insertedColumns(sql: string, freq: string) {
  const county: string[] = [];
  const state: string[] = [];
  const re = new RegExp(
    `INSERT INTO ${freq} \\([^)]*\\)\\s*SELECT (LEFT\\(tmk, 1\\)|'0'), '([a-z_0-9]+)',`,
    "g",
  );
  for (const m of sql.matchAll(re))
    (m[1] === "'0'" ? state : county).push(m[2]);
  return { county, state };
}

describe.each(TABLES)(
  "freq_$table",
  ({ table, columns, specs, identifying }) => {
    const freq = `freq_${table}`;
    const summary = (getSummaryFieldDefs(table) ?? []).map((f) => f.column);
    const dates = specs
      .filter(
        (c) => (c.kind === "excelDate" || c.kind === "ymdDate") && c.summary,
      )
      .map((c) => c.column);

    test("the dictionary has a Summary tab, on real columns, counting nothing identifying", () => {
      expect(summary.length).toBeGreaterThan(0);
      for (const c of summary) expect(columns).toContain(c);
      // FICOH data may only be reported in aggregate.
      for (const c of identifying) expect(summary).not.toContain(c);
    });

    for (const [name, file] of [
      ["hhdb-freq-tables.sql", MAIN],
      ["the standalone migration", MIGRATION],
    ] as const) {
      const sql = readFileSync(file, "utf8");

      test(`${name}: INSERTs are exactly what the loader runs after a load`, () => {
        expect(freqInsertsInSql(sql, table)).toEqual(
          freqInsertStatements(table, new Set(dates)).map((q) =>
            q.replace(/\s+/g, " "),
          ),
        );
      });

      test(`${name}: one county + one state INSERT per Summary-tab field`, () => {
        const { county, state } = insertedColumns(sql, freq);
        expect(county).toEqual(summary);
        expect(state).toEqual(summary);
      });

      test(`${name}: per-county INSERTs skip rows without a TMK; dates by year`, () => {
        const stmts =
          sql.match(
            new RegExp(
              `SELECT (?:LEFT\\(tmk, 1\\)|'0'), '[a-z_0-9]+',[^;]*FROM ${table} [^;]*;`,
              "g",
            ),
          ) ?? [];
        expect(stmts.length).toBe(summary.length * 2);
        for (const stmt of stmts) {
          const col = stmt.match(/, '([a-z_0-9]+)',/)![1];
          if (stmt.startsWith("SELECT LEFT"))
            expect(stmt).toContain("WHERE tmk IS NOT NULL");
          const byYear = stmt.includes(`CAST(YEAR(\`${col}\`) AS CHAR)`);
          expect(`${col}: ${byYear}`).toBe(`${col}: ${dates.includes(col)}`);
        }
      });
    }

    test("the main file drops, creates and regenerates it inside the shared procedure", () => {
      const sql = readFileSync(MAIN, "utf8");
      expect(sql).toContain(`DROP TABLE IF EXISTS ${freq};`);
      expect(sql).toContain(`CREATE TABLE ${freq} (`);
      const proc = sql.slice(
        sql.indexOf("CREATE PROCEDURE sp_regenerate_freq_tables()"),
        sql.indexOf("END //"),
      );
      expect(proc).toContain(`TRUNCATE TABLE ${freq};`);
    });
  },
);

test("the insurance freq migration touches nothing but its two freq_ tables", () => {
  const sql = readFileSync(MIGRATION, "utf8")
    .split("\n")
    .filter((l) => !l.startsWith("--"))
    .join("\n");
  expect(sql).not.toMatch(/\bDROP\b/i);
  const tables = [
    ...sql.matchAll(/\b(?:INTO|TABLE(?: IF NOT EXISTS)?)\s+`?(\w+)`?/g),
  ].map((m) => m[1]);
  expect(new Set(tables)).toEqual(
    new Set(["freq_insurance_policies", "freq_insurance_claims"]),
  );
});
