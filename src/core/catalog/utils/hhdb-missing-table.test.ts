import { describe, expect, test } from "bun:test";

import { isMissingTableError } from "./hhdb-missing-table";

describe("isMissingTableError", () => {
  test("matches errno 1146 (number or string)", () => {
    expect(isMissingTableError({ errno: 1146 })).toBe(true);
    expect(isMissingTableError({ errno: "1146" })).toBe(true);
  });

  test("matches the symbolic code and SQLSTATE", () => {
    expect(isMissingTableError({ code: "ER_NO_SUCH_TABLE" })).toBe(true);
    expect(isMissingTableError({ sqlState: "42S02" })).toBe(true);
  });

  test("falls back to the server message", () => {
    expect(
      isMissingTableError(
        new Error("Table 'hawaii_housing_database.mls_listings' doesn't exist"),
      ),
    ).toBe(true);
  });

  test("does not swallow other errors", () => {
    expect(isMissingTableError(new Error("Unknown column 'x'"))).toBe(false);
    expect(isMissingTableError({ errno: 1054 })).toBe(false);
    expect(isMissingTableError(new Error("Connection closed"))).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError("doesn't exist")).toBe(false);
  });
});
