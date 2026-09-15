import { describe, expect, it } from "bun:test";

import {
  COLUMN_VALUE_PARSERS,
  GENERIC_SECTION_MAP,
  parsePercent,
  parseDimensionsUnits,
  repositionGrossBuildingValue,
  resolveColumnName,
  SECTION_ROW_TRANSFORMS,
  sectionRows,
  type Row,
} from "./qpub-load";

describe("parseDimensionsUnits", () => {
  it("splits the standard cell", () => {
    expect(parseDimensionsUnits("0x0 320 / 1")).toEqual({
      dimensions: "0x0",
      area: 320,
      quantity: 1,
    });
  });

  // Quantities above one genuinely occur — "0x0 1008 / 2" was in the sample.
  it("reads a quantity above one", () => {
    expect(parseDimensionsUnits("0x0 1008 / 2")).toEqual({
      dimensions: "0x0",
      area: 1008,
      quantity: 2,
    });
  });

  it("handles real dimensions and thousands separators", () => {
    expect(parseDimensionsUnits("12x20 1,728 / 1")).toEqual({
      dimensions: "12x20",
      area: 1728,
      quantity: 1,
    });
  });

  it("tolerates surrounding whitespace and spacing around the slash", () => {
    expect(parseDimensionsUnits("  0x0 60/1  ")).toEqual({
      dimensions: "0x0",
      area: 60,
      quantity: 1,
    });
  });

  // Returning null means the value is dropped rather than mis-split, which is
  // the safe direction for a format we only sampled.
  it("returns null for anything not in that shape", () => {
    expect(parseDimensionsUnits("")).toBeNull();
    expect(parseDimensionsUnits(null)).toBeNull();
    expect(parseDimensionsUnits("320 sqft")).toBeNull();
    expect(parseDimensionsUnits("0x0 320")).toBeNull();
  });
});

describe("accessory_information row transform", () => {
  const transform = SECTION_ROW_TRANSFORMS.accessory_information;

  it("replaces dimensions_units with its three parts", () => {
    const row: Row = {
      building_number: "1",
      description: "METAL UTILITY SHED",
      dimensions_units: "0x0 1728 / 1",
      year_built: "2009",
      percent_complete: "100%",
      value: 77254,
    };
    expect(transform(row)).toEqual({
      building_number: "1",
      description: "METAL UTILITY SHED",
      year_built: "2009",
      percent_complete: "100%",
      value: 77254,
      dimensions: "0x0",
      area: 1728,
      quantity: 1,
    });
  });

  it("leaves the row alone when the cell can't be split", () => {
    const row: Row = { description: "WOOD DECK", dimensions_units: "n/a" };
    expect(transform(row)).toEqual(row);
  });
});

describe("sectionRows", () => {
  it("prefers table_data", () => {
    expect(sectionRows({ table_data: [{ a: 1 }, { a: 2 }] })).toHaveLength(2);
  });

  // Maui's Accessory Information is rendered by a control named grdSales, so
  // the parser files its rows under "sales" rather than table_data.
  it("falls back to the first array-valued property", () => {
    const section = { sales: [{ description: "WOOD DECK" }] };
    expect(sectionRows(section)).toEqual([{ description: "WOOD DECK" }]);
  });

  it("treats a section with no arrays as a single row", () => {
    expect(sectionRows({ description: "x" })).toEqual([{ description: "x" }]);
  });
});

describe("section mapping", () => {
  it("routes both counties' headings to accessory_improvements", () => {
    expect(GENERIC_SECTION_MAP.other_building_and_yard_improvements).toBe(
      "accessory_improvements",
    );
    expect(GENERIC_SECTION_MAP.accessory_information).toBe(
      "accessory_improvements",
    );
  });

  it("no longer routes anything to accessory_structures", () => {
    expect(Object.values(GENERIC_SECTION_MAP)).not.toContain(
      "accessory_structures",
    );
  });
});

describe("gross_building_value alias", () => {
  const columns = new Set(["description", "area", "quantity", "value"]);

  it("maps Oahu's heading onto the shared value column", () => {
    expect(resolveColumnName("gross_building_value", columns, [])).toBe("value");
  });

  it("leaves Maui's own spelling alone", () => {
    expect(resolveColumnName("value", columns, [])).toBe("value");
  });
});

describe("agricultural_assessments aliases", () => {
  const columns = new Set([
    "acres_in_production",
    "agricultural_value",
    "use_description",
  ]);

  it("maps Maui's bare Acres onto acres_in_production", () => {
    expect(resolveColumnName("acres", columns, [])).toBe("acres_in_production");
  });

  it("maps Maui's Assessed Value onto agricultural_value", () => {
    expect(resolveColumnName("assessed_value", columns, [])).toBe(
      "agricultural_value",
    );
  });

  it("maps Maui's Description onto use_description", () => {
    expect(resolveColumnName("description", columns, [])).toBe(
      "use_description",
    );
  });

  it("leaves Oahu/Big Island's own spellings alone", () => {
    expect(resolveColumnName("acres_in_production", columns, [])).toBe(
      "acres_in_production",
    );
    expect(resolveColumnName("use_description", columns, [])).toBe(
      "use_description",
    );
  });

  it("does NOT redirect description in tables that have their own", () => {
    // accessory_improvements (and the tax tables) carry a real description
    // column; the direct match must win over the ag alias.
    const accessory = new Set(["description", "area", "quantity", "value"]);
    expect(resolveColumnName("description", accessory, [])).toBe("description");
  });
});

describe("repositionGrossBuildingValue", () => {
  it("moves the dollar amount from area to value on summary rows", () => {
    const row = repositionGrossBuildingValue({
      description: "GROSS BUILDING VALUE",
      quantity: "1",
      year_built: "2001",
      area: "218,200",
    });
    expect(row.value).toBe("218,200");
    expect(row.area).toBeNull();
  });

  it("leaves real structure rows untouched", () => {
    const row = { description: "REINFORCED CONCRETE POOL", area: "512" };
    expect(repositionGrossBuildingValue(row)).toBe(row);
  });

  it("leaves Big Island rows that already carry their own value", () => {
    const row = {
      description: "GROSS BUILDING VALUE",
      area: "480",
      gross_building_value: "$33,100",
    };
    expect(repositionGrossBuildingValue(row)).toBe(row);
  });

  it("is wired to both yard section keys", () => {
    expect(SECTION_ROW_TRANSFORMS.other_building_and_yard_improvements).toBe(
      repositionGrossBuildingValue,
    );
    expect(SECTION_ROW_TRANSFORMS.yard_improvement_information).toBe(
      repositionGrossBuildingValue,
    );
  });
});

describe("parsePercent", () => {
  it("reads the scraped form", () => {
    expect(parsePercent("100%")).toBe(100);
    expect(parsePercent("0%")).toBe(0);
  });

  it("accepts a bare number and rounds", () => {
    expect(parsePercent("75")).toBe(75);
    expect(parsePercent(97.5)).toBe(98);
  });

  // Blank must stay NULL — 0 is a real percentage and would be a lie.
  it("keeps blank and unparseable values null", () => {
    expect(parsePercent("")).toBeNull();
    expect(parsePercent("   ")).toBeNull();
    expect(parsePercent(null)).toBeNull();
    expect(parsePercent("n/a")).toBeNull();
  });
});

describe("COLUMN_VALUE_PARSERS", () => {
  it("strips Oahu's thousands separators from area", () => {
    expect(COLUMN_VALUE_PARSERS.area("297,000")).toBe(297000);
    expect(COLUMN_VALUE_PARSERS.area("1,486")).toBe(1486);
  });

  // The Maui split already yields a number; it must survive unchanged so the
  // two counties agree on one representation.
  it("leaves an already-numeric area alone", () => {
    expect(COLUMN_VALUE_PARSERS.area(1728)).toBe(1728);
  });

  it("covers the largest observed area", () => {
    expect(COLUMN_VALUE_PARSERS.area("11,091,000")).toBe(11091000);
  });

  it("routes percent_complete through parsePercent", () => {
    expect(COLUMN_VALUE_PARSERS.percent_complete("100%")).toBe(100);
  });
});
