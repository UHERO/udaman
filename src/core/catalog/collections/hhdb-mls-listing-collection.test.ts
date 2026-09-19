import { describe, expect, test } from "bun:test";

import { MLS_COLUMNS } from "@/core/crawlers/mls/columns";

import {
  hhdbMlsListingRowToJSON,
  MLS_LISTING_SELECT_COLUMNS,
} from "../models/hhdb-mls-listing";
import { HHDB_DATA_DICTIONARY } from "../types/hhdb-data-dictionary";
import { buildMlsListingListSql } from "./hhdb-mls-listing-collection";

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

describe("buildMlsListingListSql", () => {
  test("defaults to newest listings first with an id tie-break", () => {
    const { rowsSql, rowsParams } = buildMlsListingListSql({
      page: 2,
      limit: 50,
    });
    expect(rowsSql).toContain(
      "ORDER BY `list_date` DESC, `id` DESC LIMIT ? OFFSET ?",
    );
    expect(rowsParams).toEqual([50, 50]);
  });

  test("backtick-quotes every identifier, including reserved-word columns", () => {
    const { rowsSql, countSql } = buildMlsListingListSql({
      page: 1,
      limit: 25,
      search: "kahala",
      sort: "view",
      order: "asc",
    });
    for (const col of ["view", "security", "pool"]) {
      expect(rowsSql).toContain(`\`${col}\``);
    }
    expect(rowsSql).toContain("ORDER BY `view` ASC, `id` ASC");
    expect(bareIdentifiers(rowsSql)).toEqual([]);
    expect(bareIdentifiers(countSql)).toEqual([]);
  });

  test("search covers the documented filter columns", () => {
    const { countSql, countParams } = buildMlsListingListSql({
      page: 1,
      limit: 25,
      search: "sold",
    });
    for (const col of [
      "island",
      "status",
      "property_type",
      "region",
      "tmk",
      "mls_number",
    ]) {
      expect(countSql).toContain(`\`${col}\` LIKE ?`);
    }
    expect(countParams.every((p) => p === "%sold%")).toBe(true);
    expect(countParams.length).toBe((countSql.match(/\?/g) ?? []).length);
  });

  test("rejects a sort column that is not selected", () => {
    const { rowsSql } = buildMlsListingListSql({
      page: 1,
      limit: 25,
      sort: "id; DROP TABLE mls_listings",
    });
    expect(rowsSql).toContain("ORDER BY `list_date` DESC");
    expect(rowsSql).not.toContain("DROP");
  });
});

describe("hhdbMlsListingRowToJSON", () => {
  test("coerces by column kind and emits every selected column", () => {
    const json = hhdbMlsListingRowToJSON({
      id: "7",
      mls_board: "hbr",
      mls_number: "202412345",
      status: "active",
      list_price: "1850000",
      bedrooms: 3,
      year_built: 1947,
      list_date: new Date("2024-12-31T00:00:00Z"),
      first_seen_at: new Date("2026-09-18T21:01:00Z"),
      view: "Ocean, Sunset",
    });
    expect(json.id).toBe(7);
    expect(json.list_price).toBe(1850000);
    expect(json.bedrooms).toBe(3);
    expect(json.list_date).toBe("2024-12-31");
    expect(json.first_seen_at).toBe("2026-09-18T21:01:00.000Z");
    expect(json.view).toBe("Ocean, Sunset");
    expect(json.sold_price).toBeNull();
    expect(Object.keys(json).sort()).toEqual(
      [...MLS_LISTING_SELECT_COLUMNS].sort(),
    );
  });
});

describe("mls_listings data dictionary", () => {
  const fields = HHDB_DATA_DICTIONARY.mls_listings;
  const byKey = new Map(fields.map((f) => [f.key, f]));

  test("has one entry per MLS_COLUMNS spec plus the loader columns, no duplicates", () => {
    expect(byKey.size).toBe(fields.length);
    for (const col of MLS_COLUMNS) expect(byKey.has(col.column)).toBe(true);
    for (const key of [
      "mls_number",
      "mls_board",
      "status",
      "source_site",
      "first_seen_at",
      "last_seen_at",
    ]) {
      expect(byKey.has(key)).toBe(true);
    }
    for (const key of ["extra", "html_path", "source_priority", "status_raw"]) {
      expect(byKey.has(key)).toBe(false);
    }
  });

  test("maps kind to format", () => {
    expect(byKey.get("list_price")?.format).toBe("dollar");
    expect(byKey.get("bedrooms")?.format).toBe("number");
    expect(byKey.get("year_built")?.format).toBe("year");
    expect(byKey.get("list_date")?.format).toBe("text");
  });

  test("summaries cover categorical and numeric fields, not free text", () => {
    for (const key of [
      "status",
      "island",
      "region",
      "property_type",
      "tenure",
      "list_price",
      "sold_price",
      "living_sf",
      "bedrooms",
    ]) {
      expect(byKey.get(key)?.summary).toEqual(["summary"]);
    }
    for (const key of ["remarks", "amenities", "view", "open_house"]) {
      expect(byKey.get(key)?.summary).toBeUndefined();
    }
  });
});
