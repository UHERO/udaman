import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { parseList } from "./parse-list";
import { parseProfile } from "./parse-profile";
import { expandTmk, normalizeNameForTest } from "./test-helpers";
import { DccaParseError } from "./types";

const FIXTURES = join(import.meta.dir, "fixtures");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

describe("parseList", () => {
  const entries = parseList(fixture("index-snippet.html"));

  test("one entry per registration number, first row wins on duplicates", () => {
    expect(entries.map((e) => e.reg)).toEqual([
      "5642",
      "3861",
      "4655",
      "4656",
      "4659",
      "2344",
      "7935",
    ]);
    const dup = entries.find((e) => e.reg === "7935");
    expect(dup?.name).toBe("HALE NANEA CONDOMINIUMS");
    expect(dup?.addressLine).toBe("75-216 HUALALAI RD");
  });

  test("decodes the entity-encoded names and splits the address line off", () => {
    expect(entries[0]).toEqual({
      reg: "5642",
      name: '"AKAHAI" CONDOMINIUM',
      addressLine: "LOT 52-A-2 KUHIO HWY",
      url: "https://web3.dcca.hawaii.gov/reb/public/result2?reg=5642",
    });
    expect(entries[1].name).toBe("'AINA MAUKA CONDOMINIUMS");
    expect(entries[5]).toMatchObject({
      name: "10 GRANDVIEW PLACE CONDOMINIUM PROJECT",
      addressLine: "10 GRANDVIEW PL",
    });
  });

  test("a page without the results table is a parse error, not an empty list", () => {
    expect(() => parseList("<html><body>nope</body></html>")).toThrow(
      DccaParseError,
    );
  });
});

describe("parseProfile", () => {
  test("reads every field of a full profile", () => {
    const p = parseProfile(fixture("profile-6368.html"), "6368");
    expect(p).toMatchObject({
      reg: "6368",
      name: "WIEST CONDOMINIUM",
      street: "524 KAI HELE KU ST",
      city: "LAHAINA",
      state: "HI",
      zip: "96761",
      address: "524 KAI HELE KU ST, LAHAINA, HI 96761",
      developer: "WILLIAM M WIEST",
      zoning: "AG",
      tmkRaw: "247009031",
      tmk: "2-4-7-009-031-0000",
      buildings: 2,
      floors: 1,
      totalUnits: 2,
      residential: 0,
      commercial: 0,
      agricultural: 1,
      parking: 0,
      toolSheds: 0,
      other: 1,
      ohana: "No",
      converted: "Yes",
      landOwnership: "FEE SIMPLE",
      url: "https://web3.dcca.hawaii.gov/reb/public/result2?reg=6368",
    });
    expect(p?.extra).toEqual({});
    expect(p?.filings).toEqual([
      {
        label: "Developer's Public Report",
        kind: "Initial",
        file: "6368B.pdf",
        url: "https://web3.dcca.hawaii.gov/reb/public/docs/6368B.pdf",
      },
      {
        label: "Developer's Public Report",
        kind: "Annual Report",
        file: "6368A.pdf",
        url: "https://web3.dcca.hawaii.gov/reb/public/docs/6368A.pdf",
      },
    ]);
  });

  test("keeps quotes in names, tolerates an empty zip, and reads Oahu TMKs", () => {
    const akahai = parseProfile(fixture("profile-5642.html"), "5642");
    expect(akahai).toMatchObject({
      name: '"AKAHAI" CONDOMINIUM',
      zip: null,
      address: "LOT 52-A-2 KUHIO HWY, HANALEI, HI",
      tmk: "4-5-8-008-058-0000",
      converted: "No",
    });
    expect(akahai?.filings.map((f) => [f.kind, f.file])).toEqual([
      ["Final", "5642F.pdf"],
      ["Supplementary", "5642S.pdf"],
    ]);

    const cycle = parseProfile(fixture("profile-5650.html"), "5650");
    expect(cycle).toMatchObject({
      name: "CYCLE CITY CENTER",
      zoning: "B-2",
      tmk: "1-1-1-010-009-0000",
      totalUnits: 3,
      other: 3,
    });
  });

  test("an ampersand in the street survives the double encoding", () => {
    const p = parseProfile(fixture("profile-9200.html"), "9200");
    expect(p?.street).toBe("747 KAI HELE KU ST & 14 W HUAPALA PL");
    expect(p?.developer).toBe("CURTIS W WELCH, ETAL");
  });

  test("an unknown registration number is null, not an error", () => {
    expect(
      parseProfile(fixture("profile-not-found.html"), "999999"),
    ).toBeNull();
  });

  test("a page for a different registration than requested is refused", () => {
    expect(() => parseProfile(fixture("profile-6368.html"), "5650")).toThrow(
      DccaParseError,
    );
  });

  test("unknown labels land in extra instead of being dropped", () => {
    const html = fixture("profile-6368.html").replace(
      "Land Ownership        <em>FEE SIMPLE</em> <br>",
      "Land Ownership        <em>FEE SIMPLE</em> <br> \nElevators             <em>2</em> <br>",
    );
    expect(parseProfile(html, "6368")?.extra).toEqual({ Elevators: "2" });
  });
});

describe("expandTmk", () => {
  test("9 digits → dashed parent parcel; 13 digits keep the CPR", () => {
    expect(expandTmk("247009031")).toBe("2-4-7-009-031-0000");
    expect(expandTmk(" 111010009 ")).toBe("1-1-1-010-009-0000");
    expect(expandTmk("2470090310012")).toBe("2-4-7-009-031-0012");
  });
  test("anything else is null", () => {
    for (const bad of ["", "24700903", "24700903123", "947009031", "N/A"]) {
      expect(expandTmk(bad)).toBeNull();
    }
  });
});

describe("normalizeName", () => {
  test("strips the words both sources disagree on", () => {
    expect(normalizeNameForTest("'AINA MAUKA CONDOMINIUMS")).toBe("AINA MAUKA");
    expect(normalizeNameForTest("Aina Mauka")).toBe("AINA MAUKA");
    expect(normalizeNameForTest('"AKAHAI" CONDOMINIUM')).toBe("AKAHAI");
    expect(normalizeNameForTest("HALE NANEA CONDOMINIUMS  (514B, HRS)")).toBe(
      "HALE NANEA",
    );
    expect(normalizeNameForTest("The Ilikai Apartment Building, Inc.")).toBe(
      "ILIKAI BUILDING",
    );
    expect(normalizeNameForTest("KAI & MAKANA PHASE II")).toBe("KAI MAKANA");
  });
  test("a name made only of noise words does not collapse to empty", () => {
    expect(normalizeNameForTest("The Condominium")).toBe("THE CONDOMINIUM");
    expect(normalizeNameForTest("")).toBe("");
  });
});
