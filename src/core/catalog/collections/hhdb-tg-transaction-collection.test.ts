import { describe, expect, test } from "bun:test";

import {
  hhdbTgTransactionRowToJSON,
  TG_SORTABLE_COLUMNS,
  TG_TRANSACTION_COLUMN_NAMES,
} from "../models/hhdb-tg-transaction";
import { HHDB_DATA_DICTIONARY } from "../types/hhdb-data-dictionary";
import {
  buildTgTransactionListSql,
  searchColumn,
} from "./hhdb-tg-transaction-collection";

/** Strip quoted identifiers, placeholders and SQL keywords; nothing bare may remain. */
function bareIdentifiers(sql: string): string[] {
  return sql
    .replace(/`[^`]+`/g, "")
    .replace(
      /\b(SELECT|COUNT|AS|cnt|FROM|WHERE|LIKE|OR|ORDER|BY|ASC|DESC|LIMIT|OFFSET)\b/g,
      "",
    )
    .split(/[^A-Za-z_]+/)
    .filter(Boolean);
}

describe("buildTgTransactionListSql", () => {
  test("defaults to most recently recorded first with an id tie-break", () => {
    const { rowsSql, rowsParams, filtered } = buildTgTransactionListSql({
      page: 3,
      limit: 25,
    });
    expect(rowsSql).toContain(
      "ORDER BY `recDate` DESC, `id` DESC LIMIT ? OFFSET ?",
    );
    expect(rowsParams).toEqual([25, 50]);
    expect(filtered).toBe(false);
  });

  test("selects every model column, backtick-quoted", () => {
    const { rowsSql, countSql } = buildTgTransactionListSql({
      page: 1,
      limit: 25,
      search: "1-2-3",
      sort: "tmk",
      order: "asc",
    });
    for (const col of TG_TRANSACTION_COLUMN_NAMES) {
      expect(rowsSql).toContain(`\`${col}\``);
    }
    expect(rowsSql).toContain("ORDER BY `tmk` ASC, `id` ASC");
    expect(bareIdentifiers(rowsSql)).toEqual([]);
    expect(bareIdentifiers(countSql)).toEqual([]);
  });

  test("search is a prefix match on exactly one indexed column, picked by the term's shape", () => {
    const cases: [string, string, string][] = [
      ["  Kai ", "neighborhood", "Kai%"],
      ["1-2-3-004", "tmk", "1-2-3-004%"],
      ["123004", "taxKey", "123004%"],
      ["Ewa Beach", "neighborhood", "Ewa Beach%"],
    ];
    for (const [search, column, param] of cases) {
      const { countSql, countParams, filtered } = buildTgTransactionListSql({
        page: 1,
        limit: 25,
        search,
      });
      expect(countSql).toContain(`WHERE \`${column}\` LIKE ?`);
      // One column, one placeholder: an OR across the three indexes makes
      // COUNT(*) fetch every matched row (30–46 s on the remote).
      expect(countSql).not.toContain(" OR ");
      expect(countParams).toEqual([param]);
      expect(filtered).toBe(true);
    }
    // Never a leading wildcard: that would defeat the indexes on a 3.7M-row table.
    expect(searchColumn("%x")).toBe("neighborhood");
    expect(
      buildTgTransactionListSql({ page: 1, limit: 25, search: "  " }).filtered,
    ).toBe(false);
  });

  test("only indexed columns can sort; anything else falls back to recDate", () => {
    for (const col of TG_SORTABLE_COLUMNS) {
      const { rowsSql } = buildTgTransactionListSql({
        page: 1,
        limit: 25,
        sort: col,
        order: "asc",
      });
      expect(rowsSql).toContain(`ORDER BY \`${col}\` ASC`);
    }
    for (const bad of [
      "docType",
      "ownerName",
      "id; DROP TABLE tg_transactions",
    ]) {
      const { rowsSql } = buildTgTransactionListSql({
        page: 1,
        limit: 25,
        sort: bad,
      });
      expect(rowsSql).toContain("ORDER BY `recDate` DESC");
      expect(rowsSql).not.toContain("DROP");
    }
  });
});

describe("hhdbTgTransactionRowToJSON", () => {
  test("coerces by column kind and emits every column", () => {
    const json = hhdbTgTransactionRowToJSON({
      id: "42",
      tmk: "1-2-3-004-005-0006",
      recDate: new Date("2025-01-02T00:00:00Z"),
      docType: "DEED",
      conveyanceAmount: "850000",
      considerationAmount: 850000,
      mailingState: "CA",
      maturityDate: null,
    });
    expect(json.id).toBe(42);
    expect(json.recDate).toBe("2025-01-02");
    expect(json.conveyanceAmount).toBe(850000);
    expect(json.considerationAmount).toBe(850000);
    expect(json.mailingState).toBe("CA");
    expect(json.maturityDate).toBeNull();
    expect(json.totalMarketValue).toBeNull();
    expect(Object.keys(json).sort()).toEqual(
      [...TG_TRANSACTION_COLUMN_NAMES].sort(),
    );
  });
});

describe("tg_transactions data dictionary", () => {
  const fields = HHDB_DATA_DICTIONARY.tg_transactions;
  const byKey = new Map(fields.map((f) => [f.key, f]));

  test("has one entry per model column, no duplicates", () => {
    expect(byKey.size).toBe(fields.length);
    expect([...byKey.keys()]).toEqual([...TG_TRANSACTION_COLUMN_NAMES]);
  });

  test("maps kind to format", () => {
    expect(byKey.get("conveyanceAmount")?.format).toBe("dollar");
    expect(byKey.get("id")?.format).toBe("number");
    expect(byKey.get("docType")?.format).toBe("text");
    expect(byKey.get("recDate")?.format).toBe("text");
  });

  test("summaries cover categorical, amount and date fields, not names or the valuation grid", () => {
    for (const key of [
      "docType",
      "taxClass",
      "transactionType",
      "neighborhood",
      "region",
      "mailingState",
      "mortgageType",
      "conveyanceAmount",
      "recDate",
    ]) {
      expect(byKey.get(key)?.summary).toEqual(["summary"]);
    }
    for (const key of [
      "firstPartyName",
      "ownerName",
      "propertyAddress",
      "propertyArea",
      "totalMarketValue",
      "currentTotalNetValue",
    ]) {
      expect(byKey.get(key)?.summary).toBeUndefined();
    }
  });
});
