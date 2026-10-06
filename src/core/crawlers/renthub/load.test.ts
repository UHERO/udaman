import { describe, expect, test } from "bun:test";

import { AddressIndex } from "../address";
import { parseCsv } from "../csv";
import { rowBudget, valueBytes } from "../packet";
import {
  BUILDING_TYPE_BUCKETS,
  BUILDING_TYPES,
  coordDecimals,
  mapHeader,
  parseRecord,
  RENTHUB_INSERT_COLUMNS,
  RenthubParseError,
} from "./columns";
import {
  chunkRows,
  geocodeRows,
  isMainlandStray,
  upsertSql,
  type GeocodeCounts,
} from "./load";
import { ParcelIndex } from "./parcels";

const OLD_HEADER =
  "id,scraped timestamp,state,city,neighborhood,zip,address,company,building type,beds,baths,sqft,rent price,granite,stainless,pool,gym,doorman,furnished,laundry,garage,garage count,clubhouse,latitude,longitude,date posted,description,year built,available at,availability status";
const NEW_HEADER = OLD_HEADER + ",unit id,property id";

/** A record as the 2026-01-07_2026-01-21 HI.csv has it, multi-line description included. */
const NEW_ROW =
  '612424885,2026-01-14 17:59:05.326,HI,Wahiawa,Wahiawa,96786,1576 California Ave APT A,Zillow,apartment building,3,2,1000,5000,N,N,N,N,N,Y,Y,N,0,N,21.502584,-158.0116,2025-10-20,"AVAILABLE 02/11/2026\n\nFully-furnished home, ""cozy""",,2025-10-20 00:00:00.0,available,29266636,19586997';

function parse(header: string, row: string, batch = "2026-01-07_2026-01-21") {
  const [h, r] = parseCsv(`${header}\n${row}\n`);
  const values = parseRecord(r, mapHeader(h), batch);
  return Object.fromEntries(
    RENTHUB_INSERT_COLUMNS.map((c, i) => [c, values[i]]),
  );
}

describe("renthub columns", () => {
  test("parses a current-format record", () => {
    const r = parse(NEW_HEADER, NEW_ROW);
    expect(r).toMatchObject({
      id: 612424885,
      batch: "2026-01-07_2026-01-21",
      tmk: null,
      coord_decimals: 4,
      scraped_at: "2026-01-14 17:59:05.326",
      beds: 3,
      baths: "2",
      sqft: 1000,
      rent_price: "5000",
      granite: 0,
      furnished: 1,
      garage_count: 0,
      latitude: "21.502584",
      date_posted: "2025-10-20",
      description: 'AVAILABLE 02/11/2026\n\nFully-furnished home, "cozy"',
      year_built: null,
      available_at: "2025-10-20 00:00:00.0",
      unit_id: 29266636,
      property_id: 19586997,
    });
  });

  test("older header: no unit / property ids; vendor placeholders become NULL", () => {
    const row =
      "417304007,2023-08-16 07:01:22.51,HI,Honolulu,,96815,0, Company,SFR,0,1.5,751.904157737731,1850.50,Y,N,N,N,N,N,N,N,,N,21.28,-157.83,2014-03-06,,,1970-01-01 00:00:00.0,";
    const r = parse(OLD_HEADER, row, "2014-01-01_2015-01-01");
    expect(r).toMatchObject({
      address: null,
      company: "Company",
      neighborhood: null,
      sqft: 752,
      rent_price: "1850.50",
      garage_count: null,
      description: null,
      available_at: null,
      availability_status: null,
      unit_id: null,
      property_id: null,
    });
  });

  test("rejects values that do not fit their kind", () => {
    expect(() =>
      parse(NEW_HEADER, NEW_ROW.replace(",N,N,N,N,N,Y,", ",N,N,X,N,N,Y,")),
    ).toThrow(RenthubParseError);
    expect(() => parse(NEW_HEADER, NEW_ROW.replace(",5000,", ",,"))).toThrow(
      /rent price is blank/,
    );
  });

  test("coordDecimals is the coarser of the two raw coordinates", () => {
    expect(coordDecimals("21.502584", "-158.0116")).toBe(4);
    expect(coordDecimals("21.3", "-158")).toBe(0);
    expect(coordDecimals("", "-158.0116")).toBeNull();
  });

  test("building type is bucketed; the vendor text is kept", () => {
    expect(parse(NEW_HEADER, NEW_ROW)).toMatchObject({
      building_type: "apartment",
      building_type_raw: "apartment building",
    });
    for (const [raw, bucket] of [
      ["SFR", "single-family"],
      ["Single Family House", "single-family"],
      ["CON", "condo"],
      ["TH", "townhouse"],
      ["MH", "mobile-home"],
      ["COMM", "commercial"],
      ["duplex", "other"],
      ["TIME", "other"],
      ["unknown", "other"],
    ])
      expect(
        parse(NEW_HEADER, NEW_ROW.replace(",apartment building,", `,${raw},`))
          .building_type,
      ).toBe(bucket);
    for (const b of Object.values(BUILDING_TYPES))
      expect(BUILDING_TYPE_BUCKETS).toContain(b);
  });

  test("an unmapped building type stops the load", () => {
    expect(() =>
      parse(NEW_HEADER, NEW_ROW.replace(",apartment building,", ",Yurt,")),
    ).toThrow(/"Yurt" has no bucket/);
  });

  test("rejects unknown or missing header columns", () => {
    expect(() => mapHeader([...NEW_HEADER.split(","), "pets"])).toThrow(
      /unknown column/,
    );
    expect(() =>
      mapHeader(NEW_HEADER.split(",").filter((h) => h !== "beds")),
    ).toThrow(/missing column/);
  });
});

describe("geocodeRows: condo units", () => {
  test("a listing whose unit is a CPR on its parcel gets the CPR tmk", () => {
    const idx = new ParcelIndex();
    idx.add(
      {
        division: "1",
        zone: "5",
        section: "0",
        plat1: "123",
        parcel1: "045",
        st_areashape: 1,
      },
      {
        type: "Polygon",
        coordinates: [
          [
            [-158.0115, 21.502],
            [-158.0105, 21.502],
            [-158.0105, 21.503],
            [-158.0115, 21.503],
            [-158.0115, 21.502],
          ],
        ],
      },
    );
    const addresses = new AddressIndex();
    addresses.add("1-5-0-123-045-0000", "1576 CALIFORNIA AVE");
    addresses.add("1-5-0-123-045-0007", "1576 CALIFORNIA AVE APT A");
    addresses.add("1-5-0-123-045-0008", "1576 CALIFORNIA AVE APT B");
    const inside = parse(
      NEW_HEADER,
      NEW_ROW.replace("21.502584,-158.0116", "21.5025,-158.011"),
    );
    const row = RENTHUB_INSERT_COLUMNS.map((c) => inside[c]);
    const counts = geocodeRows([row], idx, addresses, {
      maxNearestM: 0,
      addressRadiusM: 300,
    });
    const at = (c: string) => row[RENTHUB_INSERT_COLUMNS.indexOf(c)];
    // "1576 California Ave APT A": parcel by point + address, then unit A.
    expect([
      at("tmk"),
      at("tmk_match"),
      at("cpr_match"),
      at("tmk_address"),
    ]).toEqual([
      "1-5-0-123-045-0007",
      "within_addr",
      "unit",
      "1576 CALIFORNIA AVE APT A",
    ]);
    expect(counts.cpr_unit).toBe(1);
  });
});

describe("isMainlandStray", () => {
  const row = (lat: string | null, lon: string | null, zip: string) =>
    RENTHUB_INSERT_COLUMNS.map((c) =>
      c === "latitude"
        ? lat
        : c === "longitude"
          ? lon
          : c === "zip"
            ? zip
            : null,
    );
  test("outside Hawaii with no Hawaii ZIP is dropped; anything else stays", () => {
    expect(isMainlandStray(row("36.1147", "-115.1728", "89103"))).toBe(true); // Las Vegas
    expect(isMainlandStray(row("40.80", "-81.38", "44703"))).toBe(true); // Canton OH
    expect(isMainlandStray(row("21.30", "-157.85", "96813"))).toBe(false);
    // A Honolulu listing with a bad point keeps its Hawaii ZIP.
    expect(isMainlandStray(row("40.0", "-80.0", "96813"))).toBe(false);
    // A bad ZIP on a Hawaii point stays; so does a row with no point.
    expect(isMainlandStray(row("21.30", "-157.85", "95814"))).toBe(false);
    expect(isMainlandStray(row(null, null, "89103"))).toBe(false);
  });
});

describe("renthub load", () => {
  test("upsert lets the newer batch win and assigns batch last", () => {
    const sql = upsertSql(2);
    expect(sql.match(/\(\?(, \?)*\)/g)).toHaveLength(2);
    expect(sql).toContain(
      "`rent_price` = IF(VALUES(`batch`) >= `batch`, VALUES(`rent_price`), `rent_price`)",
    );
    expect(sql).toContain(
      "`tmk` = IF(VALUES(`batch`) >= `batch`, VALUES(`tmk`), `tmk`)",
    );
    expect(sql).not.toContain("`id` = ");
    expect(sql.endsWith("`batch` = GREATEST(`batch`, VALUES(`batch`))")).toBe(
      true,
    );
  });

  test("chunks fit the server's packet budget, measured in UTF-8 bytes", () => {
    // 600 rows with a ~3 KB multi-byte description: ~1.8 MB in all.
    const row = parse(NEW_HEADER, NEW_ROW);
    const big = RENTHUB_INSERT_COLUMNS.map((c) =>
      c === "description" ? "ʻ".repeat(1500) : row[c],
    );
    const rows = Array.from({ length: 600 }, () => big);
    const budget = rowBudget(1024 * 1024);
    const chunks = chunkRows(rows, budget);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toHaveLength(600);
    for (const c of chunks) {
      const bytes = c.reduce(
        (n, r) => n + r.reduce<number>((m, v) => m + valueBytes(v), 0),
        0,
      );
      expect(bytes).toBeLessThanOrEqual(budget);
    }
  });
});

describe("geocodeRows", () => {
  test("fills the tmk columns and counts outcomes", () => {
    const idx = new ParcelIndex();
    idx.add(
      {
        division: "1",
        zone: "5",
        section: "0",
        plat1: "123",
        parcel1: "045",
        st_areashape: 1,
      },
      {
        type: "Polygon",
        coordinates: [
          [
            [-158.0115, 21.502],
            [-158.0105, 21.502],
            [-158.0105, 21.503],
            [-158.0115, 21.503],
            [-158.0115, 21.502],
          ],
        ],
      },
    );
    const inside = parse(
      NEW_HEADER,
      NEW_ROW.replace("21.502584,-158.0116", "21.5025,-158.011"),
    );
    // NEW_ROW's -158.0116 is ~10 m west of the parcel.
    const outside = parse(NEW_HEADER, NEW_ROW);
    const rows = [inside, outside].map((r) =>
      RENTHUB_INSERT_COLUMNS.map((c) => r[c]),
    );
    const tmk = RENTHUB_INSERT_COLUMNS.indexOf("tmk");
    const geo = (
      rowsIn: typeof rows,
      a: AddressIndex | null,
      maxNearestM = 0,
    ) => geocodeRows(rowsIn, idx, a, { maxNearestM, addressRadiusM: 300 });
    const counts = (o: Partial<GeocodeCounts>) => ({
      within_addr: 0,
      address: 0,
      fuzzy: 0,
      address_far: 0,
      within: 0,
      nearest: 0,
      unmatched: 0,
      cpr_unit: 0,
      cpr_unit_variant: 0,
      cpr_house_address: 0,
      ...o,
    });

    // Point only: inside → within; 10 m outside → unmatched unless opted in.
    expect(geo(rows, null)).toEqual(counts({ within: 1, unmatched: 1 }));
    expect(rows[1][tmk]).toBeNull();
    expect(geo(rows, null, 50)).toEqual(counts({ within: 1, nearest: 1 }));
    expect(rows[1].slice(tmk, tmk + 2)).toEqual([
      "1-5-0-123-045-0000",
      "nearest",
    ]);

    // With qPublic addresses: the listing's "1576 California Ave APT A".
    const addresses = new AddressIndex();
    addresses.add("1-5-0-123-045-0007", "1576 CALIFORNIA AVE 7");
    expect(geo(rows, addresses)).toEqual(
      counts({ within_addr: 1, address: 1 }),
    );
    expect(rows[0].slice(tmk, tmk + 4)).toEqual([
      "1-5-0-123-045-0000",
      "within_addr",
      0,
      "1576 CALIFORNIA AVE 7",
    ]);
    expect(rows[1].slice(tmk, tmk + 2)).toEqual([
      "1-5-0-123-045-0000",
      "address",
    ]);
    expect(rows[1][tmk + 2]).toBeCloseTo(10.4, 0);
  });
});
