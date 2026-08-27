import { readFileSync } from "fs";
import path from "path";

import { describe, expect, it } from "bun:test";

import { condoUnitRows, parsePropertyHTML } from "./parse";
import { looksLikeCondoMaster } from "./scrape";

const FIXTURES = path.join(__dirname, "__fixtures__");

function load(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf-8");
}

describe("looksLikeCondoMaster", () => {
  it("flags an Oahu condo master", () => {
    expect(looksLikeCondoMaster(load("oahu-condo-project.html"))).toBe(true);
  });

  // The gate is what keeps the scraper from parsing every page it saves, so a
  // false positive costs a needless full parse on ~600k files.
  for (const name of [
    "oahu-residential.html",
    "oahu-condo-unit.html",
    "oahu-apartment-building.html",
    "maui-residential.html",
    "captcha.html",
  ]) {
    it(`does not flag ${name}`, () => {
      expect(looksLikeCondoMaster(load(name))).toBe(false);
    });
  }
});

describe("condoUnitRows", () => {
  it("reads the Oahu unit roster", () => {
    const parsed = parsePropertyHTML(
      load("oahu-condo-project.html"),
      "1-2-7-013-008-0000",
    );
    expect(parsed.status).toBe("condo_project");
    expect(condoUnitRows(parsed).length).toBe(211);
  });

  // Kauai titles the same table "CPR/Condo/Apt Unit Information", which lands
  // under a different section key. Reading only the Oahu key found zero units
  // on every Kauai master despite the table being present.
  it("reads a roster filed under the Kauai section name", () => {
    const parsed = {
      tmk: "4-3-5-002-002-0000",
      status: "condo_project",
      parse_date: "",
      cpr_condo_apt_unit_information: {
        table_data: [
          { parcel_number: "4350020020001", unit_number: "101" },
          { parcel_number: "4350020020002", unit_number: "102" },
        ],
      },
    };
    expect(condoUnitRows(parsed).length).toBe(2);
  });

  it("returns empty for a page with no roster", () => {
    const parsed = parsePropertyHTML(
      load("oahu-residential.html"),
      "1-3-3-041-087-0000",
    );
    expect(condoUnitRows(parsed)).toEqual([]);
  });
});
