import { describe, expect, test } from "bun:test";

import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";

import {
  buildSearchWhere,
  getSearchFields,
  HHDB_SEARCH_FIELDS,
} from "./hhdb-search";

describe("buildSearchWhere", () => {
  test("no term, no clause", () => {
    expect(buildSearchWhere("permits", { search: "" })).toEqual({
      where: "",
      params: [],
    });
  });

  test("no fields picked searches every field", () => {
    const { where, params } = buildSearchWhere("permits", { search: "abc" });
    expect(where).toBe(
      "WHERE (`tmk` LIKE ? OR `permit_number` LIKE ? OR `reason` LIKE ?)",
    );
    expect(params).toEqual(["%abc%", "%abc%", "%abc%"]);
  });

  test("picked fields narrow the clause", () => {
    expect(
      buildSearchWhere("permits", { search: "abc", searchFields: ["reason"] }),
    ).toEqual({ where: "WHERE (`reason` LIKE ?)", params: ["%abc%"] });
  });

  test("names outside the allowlist never reach the SQL", () => {
    const { where } = buildSearchWhere("permits", {
      search: "abc",
      searchFields: ["reason", "x` OR 1=1 -- ", "permit_amount"],
    });
    expect(where).toBe("WHERE (`reason` LIKE ?)");
  });

  test("only invalid names falls back to every field", () => {
    const { params } = buildSearchWhere("permits", {
      search: "abc",
      searchFields: ["nope"],
    });
    expect(params).toHaveLength(3);
  });
});

describe("getSearchFields", () => {
  test("every key is a real table slug", () => {
    for (const slug of Object.keys(HHDB_SEARCH_FIELDS))
      expect(HHDB_TABLE_CONFIG[slug]).toBeDefined();
  });

  test("single-indexed-column tables have no picker", () => {
    expect(getSearchFields("transactions")).toBeNull();
    expect(getSearchFields("rent-listings")).toBeNull();
    expect(getSearchFields("constructor")).toBeNull();
  });
});
