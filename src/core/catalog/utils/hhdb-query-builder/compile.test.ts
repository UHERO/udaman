import { describe, expect, test } from "bun:test";

import { CompileError, compileQuery } from "./compile";
import { defaultSpec, type QuerySchema, type QuerySpec } from "./spec";

const schema: QuerySchema = {
  tables: [
    {
      name: "properties",
      title: "Properties",
      group: "Property",
      onePerTmk: true,
      columns: [
        { name: "tmk", label: "TMK", kind: "string" },
        { name: "island_code", label: "Island", kind: "string" },
        { name: "zip", label: "ZIP", kind: "string" },
        { name: "living_units", label: "Living Units", kind: "number" },
        { name: "in_parcel_list", label: "In Parcel List", kind: "boolean" },
      ],
    },
    {
      name: "sales",
      title: "Sales",
      group: "Property",
      onePerTmk: false,
      columns: [
        { name: "id", label: "Id", kind: "number" },
        { name: "tmk", label: "TMK", kind: "string" },
        { name: "sale_date", label: "Sale Date", kind: "date" },
        {
          name: "sale_amount",
          label: "Sale Amount",
          kind: "number",
          format: "dollar",
        },
        { name: "instrument", label: "Instrument", kind: "string" },
      ],
    },
  ],
};

function spec(overrides: Partial<QuerySpec>): QuerySpec {
  return { ...defaultSpec("properties"), ...overrides };
}

/** Collapse whitespace so assertions read naturally. */
function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

describe("compileQuery", () => {
  test("single table with explicit columns", () => {
    const out = compileQuery(
      spec({
        columns: [
          { table: "properties", column: "tmk" },
          { table: "properties", column: "zip" },
        ],
        limit: 100,
      }),
      schema,
    );
    expect(norm(out.text)).toBe(
      "SET STATEMENT max_statement_time=30 FOR SELECT `properties`.`tmk` AS `properties__tmk`, `properties`.`zip` AS `properties__zip` FROM `properties` LIMIT 100",
    );
    expect(out.sql.values).toEqual([]);
    expect(out.outputs.map((o) => o.key)).toEqual([
      "properties__tmk",
      "properties__zip",
    ]);
  });

  test("defaults to the primary table's columns when none are chosen", () => {
    const out = compileQuery(spec({}), schema);
    expect(out.outputs).toHaveLength(5);
    expect(out.text).toContain(
      "`properties`.`living_units` AS `properties__living_units`",
    );
  });

  test("joins every extra table to the primary on tmk", () => {
    const out = compileQuery(
      spec({
        primary: "sales",
        tables: ["properties"],
        columns: [
          { table: "sales", column: "sale_amount" },
          { table: "properties", column: "zip" },
        ],
      }),
      schema,
    );
    expect(norm(out.text)).toContain(
      "FROM `sales` LEFT JOIN `properties` ON `properties`.`tmk` = `sales`.`tmk`",
    );
  });

  test("parameterises filter values and applies operators by kind", () => {
    const out = compileQuery(
      spec({
        primary: "sales",
        columns: [{ table: "sales", column: "tmk" }],
        filters: [
          { table: "sales", column: "sale_amount", op: "gt", value: "1000000" },
          {
            table: "sales",
            column: "sale_date",
            op: "between",
            value: ["2024-01-01", "2024-12-31"],
          },
          {
            table: "sales",
            column: "instrument",
            op: "contains",
            value: "50%_x",
          },
          {
            table: "sales",
            column: "instrument",
            op: "in",
            value: "DEED, LEASE",
          },
          { table: "sales", column: "sale_amount", op: "not_null" },
        ],
      }),
      schema,
    );
    expect(norm(out.text)).toContain(
      "WHERE `sales`.`sale_amount` > ? AND `sales`.`sale_date` BETWEEN ? AND ? AND `sales`.`instrument` LIKE ? AND `sales`.`instrument` IN (?,?) AND `sales`.`sale_amount` IS NOT NULL",
    );
    expect(out.sql.values).toEqual([
      1000000,
      "2024-01-01",
      "2024-12-31",
      "%50\\%\\_x%",
      "DEED",
      "LEASE",
    ]);
    expect(out.pretty).toContain("`sales`.`sale_amount` > 1000000");
    expect(out.pretty).toContain("LIKE '%50\\\\%\\\\_x%'");
  });

  test("island filter uses the primary table's tmk prefix", () => {
    const out = compileQuery(
      spec({
        primary: "sales",
        tables: ["properties"],
        columns: [{ table: "sales", column: "tmk" }],
        filters: [
          { table: "sales", column: "tmk", op: "island", value: ["1", "3"] },
        ],
      }),
      schema,
    );
    expect(norm(out.text)).toContain(
      "WHERE (`sales`.`tmk` LIKE ? OR `sales`.`tmk` LIKE ?)",
    );
    expect(out.sql.values).toEqual(["1%", "3%"]);
  });

  test("summarize groups by bucketed dates and aggregates", () => {
    const out = compileQuery(
      spec({
        primary: "properties",
        tables: ["sales"],
        summarize: {
          enabled: true,
          groupBy: [
            { table: "properties", column: "island_code" },
            { table: "sales", column: "sale_date", bucket: "year" },
          ],
          aggregates: [
            { fn: "count" },
            { fn: "avg", table: "sales", column: "sale_amount" },
          ],
        },
        sort: { key: "agg_1", dir: "desc" },
        limit: 1000,
      }),
      schema,
    );
    expect(norm(out.text)).toBe(
      "SET STATEMENT max_statement_time=30 FOR SELECT `properties`.`island_code` AS `properties__island_code`, YEAR(`sales`.`sale_date`) AS `sales__sale_date__year`, COUNT(*) AS `agg_0`, AVG(`sales`.`sale_amount`) AS `agg_1` FROM `properties` LEFT JOIN `sales` ON `sales`.`tmk` = `properties`.`tmk` GROUP BY `properties`.`island_code`, YEAR(`sales`.`sale_date`) ORDER BY `agg_1` DESC LIMIT 1000",
    );
    expect(out.outputs.map((o) => o.label)).toEqual([
      "Island",
      "Sale Date (year)",
      "Count",
      "Average of Sale Amount",
    ]);
    expect(out.outputs[3].format).toBe("dollar");
  });

  test("rejects unknown tables, columns and misapplied operators", () => {
    expect(() => compileQuery(spec({ primary: "users" }), schema)).toThrow(
      CompileError,
    );
    expect(() =>
      compileQuery(
        spec({ columns: [{ table: "properties", column: "password" }] }),
        schema,
      ),
    ).toThrow(/Unknown column/);
    expect(() =>
      compileQuery(
        spec({ columns: [{ table: "sales", column: "tmk" }] }),
        schema,
      ),
    ).toThrow(/not part of this query/);
    expect(() =>
      compileQuery(
        spec({
          filters: [
            {
              table: "properties",
              column: "living_units",
              op: "contains",
              value: "1",
            },
          ],
        }),
        schema,
      ),
    ).toThrow(/does not apply/);
    expect(() =>
      compileQuery(
        spec({
          filters: [
            {
              table: "properties",
              column: "living_units",
              op: "gt",
              value: "abc",
            },
          ],
        }),
        schema,
      ),
    ).toThrow(/not a number/);
    expect(() =>
      compileQuery(
        spec({
          summarize: {
            enabled: true,
            groupBy: [],
            aggregates: [{ fn: "sum", table: "properties", column: "zip" }],
          },
        }),
        schema,
      ),
    ).toThrow(/numeric/);
    expect(() =>
      compileQuery(
        spec({ sort: { key: "sales__sale_amount", dir: "asc" } }),
        schema,
      ),
    ).toThrow(/Cannot sort/);
  });

  test("never emits a bare identifier from user input", () => {
    const out = compileQuery(
      spec({
        primary: "sales",
        columns: [{ table: "sales", column: "instrument" }],
        filters: [
          {
            table: "sales",
            column: "instrument",
            op: "eq",
            value: "x; DROP TABLE sales",
          },
        ],
      }),
      schema,
    );
    expect(out.text).not.toContain("DROP");
    expect(out.sql.values).toEqual(["x; DROP TABLE sales"]);
  });
});
