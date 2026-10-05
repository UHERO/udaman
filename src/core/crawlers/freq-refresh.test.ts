import { describe, expect, test } from "bun:test";

import { freqInsertStatements } from "@/core/catalog/utils/hhdb-freq-sql";

import { refreshFreqTables } from "./freq-refresh";

const DATES = new Set(["date_of_loss"]);

describe("refreshFreqTables", () => {
  test("rebuilds each freq table in its own transaction: DELETE, then the dictionary's INSERTs", async () => {
    const statements: string[][] = [];
    const out = await refreshFreqTables(
      (async () => []) as never,
      async (fn) => {
        const tx: string[] = [];
        statements.push(tx);
        await fn((async (sql: string) => {
          tx.push(sql);
          return [];
        }) as never);
      },
      [{ table: "insurance_claims", dateColumns: DATES }],
    );
    expect(out).toEqual({ insurance_claims: "refreshed" });
    expect(statements).toHaveLength(1);
    expect(statements[0][0]).toBe("DELETE FROM freq_insurance_claims");
    expect(statements[0].slice(1)).toEqual(
      freqInsertStatements("insurance_claims", DATES),
    );
  });

  test("a freq table whose migration is not applied is skipped, not an error", async () => {
    let transactions = 0;
    const missing = Object.assign(
      new Error("Table 'x.freq_insurance_claims' doesn't exist"),
      {
        errno: 1146,
      },
    );
    const out = await refreshFreqTables(
      (async () => {
        throw missing;
      }) as never,
      async () => {
        transactions++;
      },
      [{ table: "insurance_claims", dateColumns: DATES }],
    );
    expect(out).toEqual({ insurance_claims: "missing" });
    expect(transactions).toBe(0);
  });
});
