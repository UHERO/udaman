import { describe, expect, it } from "bun:test";

import {
  applySql,
  createStagingSql,
  dataColumns,
  stagingColumns,
  type TableMeta,
} from "./qpub-delta-sql";
import { DELTA_ORDER, DELTA_STRATEGY } from "./qpub-delta-strategy";

const text = (name: string) => ({ name, isText: true });
const num = (name: string) => ({ name, isText: false });

const parcels: TableMeta = {
  table: "parcels",
  columns: [
    num("id"),
    text("tmk"),
    num("scraped_at"),
    num("last_year_observed"),
    num("created_at"),
    text("parcel_number"),
    text("location_address"),
    num("land_area_sqft"),
  ],
};

const landClass: TableMeta = {
  table: "land_classifications",
  columns: [
    num("id"),
    text("tmk"),
    num("scraped_at"),
    num("last_year_observed"),
    text("land_classification"),
    text("square_footage"),
  ],
};

const properties: TableMeta = {
  table: "properties",
  columns: [
    text("tmk"),
    text("island_code"),
    text("location_address"),
    num("created_at"),
    num("updated_at"),
  ],
};

describe("strategy coverage", () => {
  it("defines a strategy for every table in the load order", () => {
    for (const table of DELTA_ORDER) {
      expect(DELTA_STRATEGY[table]).toBeDefined();
    }
  });

  it("does not define strategies for tables outside the load order", () => {
    for (const table of Object.keys(DELTA_STRATEGY)) {
      expect(DELTA_ORDER).toContain(table);
    }
  });
});

describe("column selection", () => {
  it("keeps the surrogate key and created_at out of staging", () => {
    const names = stagingColumns(parcels).map((c) => c.name);
    expect(names).not.toContain("id");
    expect(names).not.toContain("created_at");
    expect(names).toContain("tmk");
    expect(names).toContain("scraped_at");
  });

  // scraped_at and last_year_observed are written by the apply, not compared —
  // including them would make every row look changed on every run.
  it("excludes bookkeeping columns and the identity from the comparison", () => {
    const names = dataColumns(landClass, ["land_classification"]).map(
      (c) => c.name,
    );
    expect(names).toEqual(["square_footage"]);
  });

  it("treats an empty identity as comparing every data column", () => {
    const names = dataColumns(parcels, []).map((c) => c.name);
    expect(names).toEqual([
      "parcel_number",
      "location_address",
      "land_area_sqft",
    ]);
  });
});

describe("comparison fidelity", () => {
  const sql = applySql(landClass).join("\n");

  // normalizeForCompare() in qpub-load.ts is `String(v ?? "").trim()`, so NULL,
  // "" and " " are one value. Plain `=` would make every NULL differ.
  it("compares text with TRIM and NULL collapsed to empty", () => {
    expect(sql).toContain("COALESCE(TRIM(l.`square_footage`), '')");
    expect(sql).toContain("COALESCE(TRIM(s.`square_footage`), '')");
  });

  it("compares non-text with null-safe equality on the native type", () => {
    const parcelSql = applySql(parcels).join("\n");
    expect(parcelSql).toContain("l.`land_area_sqft` <=> s.`land_area_sqft`");
  });
});

describe("scd apply", () => {
  const sql = applySql(landClass);

  // The whole correctness argument: matching against ANY historical version
  // would let a superseded value re-match and extend a dead row.
  it("ranks to the latest version per tmk + identity", () => {
    const create = sql.find((s) => s.includes("ROW_NUMBER()"))!;
    expect(create).toContain(
      "PARTITION BY `tmk`, `land_classification`",
    );
    expect(create).toContain(
      "ORDER BY t.last_year_observed DESC, t.id DESC",
    );
    expect(create).toContain("WHERE rn = 1");
  });

  it("scopes the ranking to the staged parcels", () => {
    const create = sql.find((s) => s.includes("ROW_NUMBER()"))!;
    expect(create).toContain("SELECT DISTINCT tmk FROM `_qpub_stg_land_classifications`");
  });

  it("extends the span when nothing changed", () => {
    const update = sql.find((s) => s.startsWith("UPDATE"))!;
    expect(update).toContain("SET t.last_year_observed = s.last_year_observed");
    expect(update).toContain("t.scraped_at = s.scraped_at");
  });

  it("inserts a new version only when no latest row matches", () => {
    const insert = sql.find((s) => s.startsWith("INSERT"))!;
    expect(insert).toContain("LEFT JOIN `_qpub_latest_land_classifications`");
    expect(insert).toContain("WHERE l.id IS NULL");
  });

  it("cleans up its scratch table", () => {
    expect(sql[sql.length - 1]).toContain(
      "DROP TABLE IF EXISTS `_qpub_latest_land_classifications`",
    );
  });
});

describe("upsert-key apply", () => {
  const sql = applySql(properties).join("\n");

  it("never overwrites created_at", () => {
    expect(sql).not.toContain("`created_at` = VALUES");
  });

  it("stamps updated_at where the column exists", () => {
    expect(sql).toContain("updated_at = NOW()");
  });

  it("does not try to update the key itself", () => {
    expect(sql).not.toContain("`tmk` = VALUES(`tmk`)");
  });
});

describe("replace-by-tmk apply", () => {
  const meta: TableMeta = {
    table: "historical_tax_details",
    columns: [num("id"), text("tmk"), num("scraped_at"), text("description")],
  };
  const sql = applySql(meta);

  it("deletes only the staged parcels, not the whole table", () => {
    const del = sql.find((s) => s.startsWith("DELETE"))!;
    expect(del).toContain("JOIN (SELECT DISTINCT tmk FROM");
    expect(del).not.toMatch(/DELETE FROM `historical_tax_details`\s*$/);
  });
});

describe("staging setup", () => {
  it("builds an empty clone without copying indexes", () => {
    const sql = createStagingSql(parcels);
    expect(sql[1]).toContain("WHERE 1=0");
    expect(sql[1]).not.toContain("LIKE");
    expect(sql[2]).toContain("ADD INDEX idx_stg_tmk (tmk)");
  });
});
