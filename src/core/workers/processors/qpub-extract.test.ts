import { describe, expect, it } from "bun:test";

import type { ParsedProperty } from "@/core/crawlers/qpub/parse";

import {
  extractCommercialImprovements,
  resetIdCounters,
  TABLE_COLUMNS,
  type ExtractItem,
} from "./qpub-extract";

type R = Record<string, unknown>;

// ─── commercial_improvement_details row emission ────────────────────

const DETAIL_COLS = TABLE_COLUMNS.commercial_improvement_details;

function col(name: string): number {
  const i = DETAIL_COLS.indexOf(name);
  if (i < 0) throw new Error(`column ${name} missing from TABLE_COLUMNS`);
  return i;
}

function makeItem(ci: R): ExtractItem {
  const data: ParsedProperty = {
    tmk: "1-2-1-010-046-0006",
    status: "success",
    parse_date: "2026-08-19",
    commercial_improvement_information: ci,
  };
  return {
    tmk: "121010460006",
    data,
    scrapedAt: new Date("2026-08-19T10:00:00"),
    observedYear: 2026,
  };
}

describe("extractCommercialImprovements condo-info rows", () => {
  it("declares the six condo columns in the details column list", () => {
    for (const name of [
      "condo_style",
      "condo_type",
      "condo_unit",
      "floor_level",
      "view",
      "project",
    ]) {
      expect(DETAIL_COLS).toContain(name);
    }
  });

  it("emits each condo_info row as its own details row under the first building", () => {
    resetIdCounters();
    const { parents, details } = extractCommercialImprovements([
      makeItem({
        buildings: [
          {
            building_number: "0001",
            structure_type: "OFFICES - M-3",
            floor_details: [{ card: "1", section: "1", floor: "06", area: "1,540" }],
          },
        ],
        condo_info: [
          {
            project: "CENTURY SQUARE",
            condo_unit: "602",
            floor_level: "06",
            condo_type: "INSIDE",
            view: "NONE",
            condo_style: "OFFICE",
          },
        ],
      }),
    ]);

    expect(parents).toHaveLength(1);
    const parentId = parents[0][0];
    expect(details).toHaveLength(2);

    // Every details row matches the full column list.
    for (const row of details) {
      expect(row).toHaveLength(DETAIL_COLS.length);
    }

    const floorRow = details[0];
    expect(floorRow[col("commercial_improvement_id")]).toBe(parentId);
    expect(floorRow[col("floor")]).toBe("06");
    expect(floorRow[col("area")]).toBe(1540);
    // Floor-detail rows never carry condo columns.
    expect(floorRow[col("project")]).toBeNull();
    expect(floorRow[col("condo_unit")]).toBeNull();

    const condoRow = details[1];
    expect(condoRow[col("commercial_improvement_id")]).toBe(parentId);
    expect(condoRow[col("project")]).toBe("CENTURY SQUARE");
    expect(condoRow[col("condo_unit")]).toBe("602");
    // floor_level is VARCHAR in the schema — "06" must stay a string,
    // never be int-coerced to 6.
    expect(condoRow[col("floor_level")]).toBe("06");
    expect(condoRow[col("condo_type")]).toBe("INSIDE");
    expect(condoRow[col("view")]).toBe("NONE");
    expect(condoRow[col("condo_style")]).toBe("OFFICE");
    // Condo-info rows never carry floor-detail columns.
    expect(condoRow[col("card")]).toBeNull();
    expect(condoRow[col("floor")]).toBeNull();
    expect(condoRow[col("area")]).toBeNull();
    expect(condoRow[col("usage")]).toBeNull();
  });

  it("drops condo_info when no building parses (FK has no parent)", () => {
    resetIdCounters();
    const { parents, details } = extractCommercialImprovements([
      makeItem({
        buildings: [],
        condo_info: [{ project: "CENTURY SQUARE", condo_unit: "602" }],
      }),
    ]);
    expect(parents).toHaveLength(0);
    expect(details).toHaveLength(0);
  });
});
