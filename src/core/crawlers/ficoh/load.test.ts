import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";

import { AddressIndex } from "../address";
import {
  CLAIM_COLUMNS,
  FicohParseError,
  mapHeader,
  normalizeZip,
  parseRow,
  POLICY_COLUMNS,
} from "./columns";
import {
  CLAIM_SHEET,
  geocodeAddress,
  linkClaims,
  load,
  POLICY_SHEET,
  policyBase,
  stripCity,
} from "./load";

const POLICY_HEADER = POLICY_COLUMNS.map((c) => c.source);
const CLAIM_HEADER = [
  "Policy_Number_Full",
  "Claim_Number",
  "Year_of_Loss",
  "Date_of_Loss",
  "Loss_Cause_Description",
  "Loss_Address",
  "Loss_City",
  "Loss_State",
  "Loss_ZIP",
  "Full_Loss_Address",
  "Paid_Loss",
  "Incurred_Loss",
  "Expense_Paid",
];

/** Excel serial for a date (1900 system). */
const serial = (ymd: string) =>
  (Date.parse(ymd + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 864e5;

/** A policy row in sheet order, as the delivered file has it. */
function policyRow(
  number: string,
  effective: string,
  address: string,
  extra: Partial<Record<string, unknown>> = {},
) {
  const [y, m, d] = effective.split("-").map(Number);
  const v: Record<string, unknown> = {
    Policy_Number_Full: number,
    Effective_Date: serial(effective),
    Expiration_Date: serial(
      `${y + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    ),
    New_Renewal: "R",
    HO_FormType: "Condo",
    Address: address,
    City: "Honolulu",
    Zip: 96814,
    HO_CovA_Limit: 100000,
    HO_CovB_Limit: 0,
    HO_CovC_Limit: 35000,
    HO_CovD_Limit: 17500,
    HO_CovE_Limit: "NULL",
    HO_CovF_Limit: "NULL",
    TIV: 1014999.585,
    Deductible: 500,
    Premium: 713,
    Hurricane_Premium: 0,
    Company_Code: 8,
    Agency_Number: 213,
    Producer_Key: "DF",
    Year_Built: 9999,
    Construction_Type: 1,
    ...extra,
  };
  return POLICY_HEADER.map((h) => v[h]);
}

describe("columns", () => {
  test("parses a policy row: placeholders → NULL, money to cents, dates without timezone", () => {
    const index = mapHeader(POLICY_HEADER, POLICY_COLUMNS);
    const row = parseRow(
      policyRow(
        "FSP250009732",
        "2018-01-01",
        "1942 KILOLANI PLACE HONOLULU HI",
      ) as never,
      index,
      POLICY_COLUMNS,
    );
    expect(row).toMatchObject({
      policy_number: "FSP250009732",
      effective_date: "2018-01-01",
      expiration_date: "2019-01-01",
      cov_e_limit: null,
      tiv: "1014999.59",
      year_built: null,
      producer_key: "DF",
      zip: "96814",
    });
  });

  test("ZIP normalization", () => {
    expect(normalizeZip("96753-    ")).toBe("96753");
    expect(normalizeZip("96748-0000")).toBe("96748");
    expect(normalizeZip("96740-8220")).toBe("96740-8220");
    expect(normalizeZip("96753-")).toBe("96753");
    expect(normalizeZip("ZIP+4")).toBeNull();
    expect(normalizeZip("9676")).toBeNull();
  });

  test("claim dates are yyyymmdd; bad values throw", () => {
    const index = mapHeader(CLAIM_HEADER, CLAIM_COLUMNS, [
      "Year_of_Loss",
      "Full_Loss_Address",
    ]);
    const base = [
      "HPX100010485503",
      "202005847CC",
      2020,
      20200811,
      "Wind",
      "Unknown",
      "Unk",
      "HI",
      "Unknown",
      "x",
      0,
      0,
      0,
    ];
    expect(parseRow(base as never, index, CLAIM_COLUMNS)).toMatchObject({
      date_of_loss: "2020-08-11",
      loss_address: null,
      loss_city: null,
      loss_zip: null,
      paid_loss: "0.00",
    });
    const bad = [...base];
    bad[3] = 2020;
    expect(() => parseRow(bad as never, index, CLAIM_COLUMNS)).toThrow(
      FicohParseError,
    );
  });

  test("unknown or missing headers are errors; unnamed trailing columns are not", () => {
    expect(() =>
      mapHeader([...POLICY_HEADER, "Territory"], POLICY_COLUMNS),
    ).toThrow(/unknown column/);
    expect(() => mapHeader(POLICY_HEADER.slice(1), POLICY_COLUMNS)).toThrow(
      /missing column/,
    );
    expect(() =>
      mapHeader([...POLICY_HEADER, null, null], POLICY_COLUMNS),
    ).not.toThrow();
  });
});

describe("addresses", () => {
  test("stripCity drops the city / HI and a leading building name", () => {
    expect(stripCity("1942 KILOLANI PLACE HONOLULU HI", "Honolulu")).toBe(
      "1942 KILOLANI PLACE",
    );
    expect(stripCity("2385 S KIHEI RD KIHEI HI", "Kihei, Wailea")).toBe(
      "2385 S KIHEI RD",
    );
    expect(
      stripCity("MAKAHA VALLEY TOWERS #1303 84-680 KILI DRIVE", "Waianae"),
    ).toBe("84-680 KILI DRIVE");
  });

  const idx = new AddressIndex();
  idx.add("1-2-3-002-106-0412", "1001 QUEEN ST APT 3713");
  idx.add("1-2-3-002-111-0020", "1001 QUEEN ST APT 405");
  idx.add("1-3-2-064-016-0000", "632 HUNALEWA ST");
  idx.add("1-3-2-064-017-0000", "632 B HUNALEWA ST");
  idx.add("1-4-7-068-055-0000", "47-544 HENOHENO ST");
  idx.add("2-3-4-010-008-0000", "114 KANOA ST WAILUKU HI 96793");
  idx.add("4-3-6-018-074-0000", "114 KANOA ST LIHUE HI 96766");

  const geo = (a: string, zip = "96814") =>
    geocodeAddress(a, "Honolulu", zip, idx);

  test("a condo unit resolves to its CPR across several parcels", () => {
    expect(geo("1001 QUEEN STREET #3713 HONOLULU HI")).toEqual({
      hit: {
        tmk: "1-2-3-002-106-0412",
        match: "unit",
        address: "1001 QUEEN ST APT 3713",
      },
      outcome: "unit",
    });
    // No unit: the building spans two parcels → ambiguous, no guess.
    expect(geo("1001 QUEEN ST").outcome).toBe("ambiguous");
  });

  test("the lot letter picks between same-number parcels", () => {
    expect(geo("632 B HUNALEWA ST", "96816").hit?.tmk).toBe(
      "1-3-2-064-017-0000",
    );
    expect(geo("632 HUNALEWA ST", "96816").hit?.tmk).toBe("1-3-2-064-016-0000");
  });

  test("the ZIP's county separates the same address on two islands", () => {
    expect(geo("114 KANOA STREET WAILUKU, HI", "96793").hit?.tmk).toBe(
      "2-3-4-010-008-0000",
    );
    expect(geo("114 KANOA ST", "96766").hit?.tmk).toBe("4-3-6-018-074-0000");
    expect(geo("114 KANOA ST", "").outcome).toBe("ambiguous");
  });

  test("fuzzy street only with a known county; missing address", () => {
    expect(geo("47-544 HENOHENE ST", "96744")).toMatchObject({
      outcome: "fuzzy",
    });
    expect(geo("47-544 HENOHENE ST", "").outcome).toBe("not_found");
    expect(geo("PAPAIKOU HI").outcome).toBe("no_address");
  });
});

describe("linkClaims", () => {
  const P = (
    id: number,
    number: string,
    eff: string,
    exp: string,
    address: string,
  ) => ({
    id,
    policy_number: number,
    policy_base: policyBase(number),
    effective_date: eff,
    expiration_date: exp,
    address,
    city: "Honolulu",
  });
  const policies = [
    P(2, "HPX100010485503", "2020-01-01", "2021-01-01", "27 HOOUI PLACE"),
    P(3, "HPX100010485504", "2021-01-01", "2022-01-01", "27 HOOUI PLACE"),
    P(4, "FSP251478613", "2020-01-01", "2021-01-01", "2754 KUILEI ST APT 1404"),
    P(5, "FSP251478613", "2020-01-01", "2021-01-01", "5087 OPELU ST"),
  ];
  const C = (number: string, date: string, address = "27 HOOUI PLACE") => ({
    policy_number: number,
    date_of_loss: date,
    loss_address: address,
    loss_city: "Honolulu",
  });

  test("term, term + address, base, ambiguous, none", () => {
    const claims: Record<string, unknown>[] = [
      C("HPX100010485503", "2020-08-11"),
      C("FSP251478613", "2020-05-01", "5087 OPELU STREET"),
      C("HPX100010485599", "2021-03-01"),
      C("FSP251478613", "2020-05-01", "1 SOMEWHERE ELSE"),
      C("HPX100010485503", "2023-01-01"),
    ];
    expect(linkClaims(policies as never, claims as never)).toEqual({
      term: 1,
      term_address: 1,
      base: 1,
      base_address: 0,
      ambiguous: 1,
      none: 1,
    });
    expect(claims.map((c) => [c.policy_id, c.policy_match])).toEqual([
      [2, "term"],
      [5, "term_address"],
      [3, "base"],
      [null, null],
      [null, null],
    ]);
  });
});

describe("load", () => {
  function workbook(): string {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [...POLICY_HEADER, null],
        policyRow(
          "FSP251478613",
          "2020-01-01",
          "1001 QUEEN STREET #3713 HONOLULU HI",
        ),
        policyRow("FSP251478613", "2020-01-01", "632 B HUNALEWA ST", {
          Zip: "96816-    ",
        }),
        policyRow(
          "FSP251478614",
          "2021-01-01",
          "1001 QUEEN STREET #3713 HONOLULU HI",
        ),
      ]),
      POLICY_SHEET,
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        CLAIM_HEADER,
        [
          "FSP251478613",
          "202006194CC",
          2020,
          20200827,
          "Water Damage",
          "632 B HUNALEWA ST",
          "Honolulu",
          "HI",
          "96816",
          "x",
          13336.91,
          13336.91,
          0,
        ],
      ]),
      CLAIM_SHEET,
    );
    const file = path.join(
      mkdtempSync(path.join(tmpdir(), "ficoh-")),
      "ficoh.xlsx",
    );
    writeFileSync(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    return file;
  }

  test("replaces both tables in one transaction, with locations, geocodes and links", async () => {
    const idx = new AddressIndex();
    idx.add("1-2-3-002-106-0412", "1001 QUEEN ST APT 3713");
    idx.add("1-3-2-064-017-0000", "632 B HUNALEWA ST");
    const statements: { sql: string; params: unknown[] }[] = [];
    let transactions = 0;
    const summary = await load({
      file: workbook(),
      addressIndex: idx,
      // Freq tables "exist"; their refresh runs in later transactions.
      db: (async () => []) as never,
      tx: async (fn) => {
        transactions++;
        await fn((async (sql: string, params: unknown[] = []) => {
          statements.push({ sql, params });
          return [];
        }) as never);
      },
    });

    // The load, then one freq refresh per table.
    expect(transactions).toBe(3);
    expect(summary.freq).toEqual({
      insurance_policies: "refreshed",
      insurance_claims: "refreshed",
    });
    expect(summary).toMatchObject({
      policies: 3,
      claims: 1,
      policyGeocode: { unit: 2, address: 1 },
      claimLinks: { term_address: 1 },
    });
    const verbs = statements
      .slice(0, 5)
      .map((s) => s.sql.split(" (")[0].trim());
    expect(verbs).toEqual([
      "DELETE FROM insurance_claims",
      "DELETE FROM insurance_policies",
      "INSERT INTO insurance_policies",
      "INSERT INTO insurance_claims",
      expect.stringContaining("INSERT INTO insurance_loads"),
    ]);
    // ids are sheet lines; the two locations under one number + term are 1, 2.
    const p = statements[2].params;
    const width = p.length / 3;
    expect([
      p[0],
      p[2],
      p[width],
      p[width + 2],
      p[2 * width],
      p[2 * width + 2],
    ]).toEqual([2, 1, 3, 2, 4, 1]);
    expect(p[3]).toBe("1-2-3-002-106-0412");
    // The claim links to sheet line 3 (the Hunalewa location).
    expect(statements[3].params.slice(0, 3)).toEqual([
      "202006194CC",
      3,
      "term_address",
    ]);
  });

  test("dry run writes nothing", async () => {
    let called = false;
    await load({
      file: workbook(),
      addressIndex: new AddressIndex(),
      db: (async () => []) as never,
      dryRun: true,
      tx: async () => {
        called = true;
      },
    });
    expect(called).toBe(false);
  });
});
