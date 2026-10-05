import { readFileSync } from "fs";
import path from "path";

import { describe, expect, test } from "bun:test";

import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";

import {
  INSURANCE_CLAIMS_LIST,
  INSURANCE_POLICIES_LIST,
  RENTHUB_LIST,
  serializeCell,
  type SpecTableDef,
} from "../models/hhdb-spec-table";
import { getSummaryFieldDefs } from "../types/hhdb-data-dictionary";
import {
  buildSpecTableListSql,
  serializeRow,
} from "./hhdb-spec-table-collection";

const HHDB_SQL = path.resolve(import.meta.dir, "../../../lib/hhdb");
/** Read as text: the registry imports server actions, which do not load under bun test. */
const REGISTRY = readFileSync(
  path.resolve(
    import.meta.dir,
    "../../../components/hhdb/hhdb-table-registry.tsx",
  ),
  "utf8",
);
const DDL: Record<string, string> = {
  renthub_listings: readFileSync(
    path.join(HHDB_SQL, "renthub_listings.sql"),
    "utf8",
  ),
  insurance_policies: readFileSync(
    path.join(HHDB_SQL, "insurance.sql"),
    "utf8",
  ),
  insurance_claims: readFileSync(path.join(HHDB_SQL, "insurance.sql"), "utf8"),
};

/** Columns that lead an index (or are the primary key) in a table's CREATE TABLE. */
function indexedColumns(table: string): Set<string> {
  const stmt = DDL[table].match(
    new RegExp(
      "CREATE TABLE IF NOT EXISTS `" + table + "` \\([\\s\\S]*?\\n\\)[^;]*;",
    ),
  )![0];
  const cols = new Set<string>();
  for (const m of stmt.matchAll(/(?:INDEX|KEY) `\w+` \(`(\w+)`/g))
    cols.add(m[1]);
  for (const m of stmt.matchAll(/`(\w+)`[^\n]*PRIMARY KEY/g)) cols.add(m[1]);
  return cols;
}

const DEFS: [string, SpecTableDef][] = [
  ["rent-listings", RENTHUB_LIST],
  ["insurance-policies", INSURANCE_POLICIES_LIST],
  ["insurance-claims", INSURANCE_CLAIMS_LIST],
];

describe.each(DEFS)("%s", (slug, def) => {
  test("is wired into the HHDB UI: config, registry, Summary fields", () => {
    expect(HHDB_TABLE_CONFIG[slug]?.fieldsTable).toBe(def.table);
    expect(HHDB_TABLE_CONFIG[slug]?.defaultSort).toBe(def.defaultSort);
    expect(REGISTRY).toContain(`"${slug}": {`);
    expect(getSummaryFieldDefs(def.table)?.length).toBeGreaterThan(0);
  });

  test("has the coverage Exploration tab", () => {
    expect(HHDB_TABLE_CONFIG[slug]?.exploration).toBe(true);
    const page = readFileSync(
      path.resolve(
        import.meta.dir,
        "../../../app/hhdb/tables/[table]/exploration/page.tsx",
      ),
      "utf8",
    );
    expect(page).toContain(`"${slug}":`);
  });

  test("carries the imputed-TMK caveat on every tab", () => {
    expect(HHDB_TABLE_CONFIG[slug]?.warning).toMatch(/TMK is imputed/);
  });

  test("every sortable column and the search columns are indexed", () => {
    const indexed = indexedColumns(def.table);
    for (const c of [...def.sortable, def.key])
      expect(`${c}: ${indexed.has(c)}`).toBe(`${c}: true`);
    for (const term of [
      "1-2-3-004",
      "96815",
      "HPX1000",
      "202300424CC",
      "Kai",
      "2025-01-08_2025",
    ]) {
      const c = def.searchColumn(term);
      expect(`${term} → ${c}: ${indexed.has(c)}`).toBe(`${term} → ${c}: true`);
    }
  });

  test("every column has a dictionary label; defaults are real columns", () => {
    const names = def.columns.map((c) => c.column);
    for (const c of def.columns) expect(c.label).not.toBe(c.column);
    for (const c of [...def.defaultVisible, ...def.sortable, def.defaultSort])
      expect(names).toContain(c);
  });
});

describe("buildSpecTableListSql", () => {
  test("unknown sort falls back to the default; key breaks ties", () => {
    const sql = buildSpecTableListSql(RENTHUB_LIST, {
      page: 2,
      limit: 50,
      sort: "description; DROP TABLE x",
      order: "asc",
    });
    expect(sql.rowsSql).toContain(
      "ORDER BY `scraped_at` ASC, `id` ASC LIMIT ? OFFSET ?",
    );
    expect(sql.rowsParams).toEqual([50, 50]);
    expect(sql.countSql).toBe("SELECT COUNT(*) AS cnt FROM `renthub_listings`");
  });

  test("search is one prefix LIKE on the column the term's shape picks", () => {
    const tmk = buildSpecTableListSql(INSURANCE_POLICIES_LIST, {
      page: 1,
      limit: 25,
      search: " 1-2-3-002 ",
    });
    expect(tmk.countSql).toBe(
      "SELECT COUNT(*) AS cnt FROM `insurance_policies` WHERE `tmk` LIKE ?",
    );
    expect(tmk.countParams).toEqual(["1-2-3-002%"]);
    const claim = buildSpecTableListSql(INSURANCE_CLAIMS_LIST, {
      page: 1,
      limit: 25,
      search: "2023_%",
    });
    expect(claim.countSql).toContain("WHERE `claim_number` LIKE ?");
    // LIKE wildcards typed by the user are literal.
    expect(claim.countParams).toEqual(["2023\\_\\%%"]);
    expect(
      buildSpecTableListSql(INSURANCE_CLAIMS_LIST, {
        page: 1,
        limit: 25,
        search: "HPX10001",
      }).countSql,
    ).toContain("`policy_number` LIKE ?");
  });

  test("the claims key is claim_number", () => {
    expect(
      buildSpecTableListSql(INSURANCE_CLAIMS_LIST, {
        page: 1,
        limit: 25,
        sort: "claim_number",
      }).rowsSql,
    ).toContain("ORDER BY `claim_number` DESC LIMIT");
  });
});

describe("serialization", () => {
  test("dates, vendor datetimes, decimals and flags", () => {
    expect(serializeCell("date", new Date("2023-08-08T00:00:00Z"))).toBe(
      "2023-08-08",
    );
    // Vendor clock as stored — not shifted into HST.
    expect(
      serializeCell("datetime", new Date("2026-01-14T17:58:24.775Z")),
    ).toBe("2026-01-14 17:58:24.775");
    expect(serializeCell("money", "13336.91")).toBe(13336.91);
    expect(serializeCell("flag", true)).toBe(1);
    expect(serializeCell("text", "")).toBeNull();
  });

  test("a row keeps exactly the defined columns", () => {
    const row = serializeRow(INSURANCE_CLAIMS_LIST, {
      claim_number: "202005847CC",
      date_of_loss: new Date("2020-08-11T00:00:00Z"),
      paid_loss: "0.00",
      extra: "dropped",
    });
    expect(Object.keys(row)).toEqual(
      INSURANCE_CLAIMS_LIST.columns.map((c) => c.column),
    );
    expect(row).toMatchObject({
      claim_number: "202005847CC",
      date_of_loss: "2020-08-11",
      paid_loss: 0,
      tmk: null,
    });
  });
});
