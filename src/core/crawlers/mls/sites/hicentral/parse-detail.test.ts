import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { MLS_COLUMN_NAMES, MLS_COLUMNS } from "../../columns";
import { MlsParseError } from "../../types";
import type { NormalizedListing } from "../../types";
import { HICENTRAL_HEADER_EXTRA_KEYS, parseDetail } from "./parse-detail";

const FIXTURES = join(import.meta.dir, "fixtures");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

const DETAIL_FIXTURES = readdirSync(FIXTURES)
  .filter((f) => f.startsWith("detail-") && !f.includes("not-found"))
  .sort();

function parsed(name: string): NormalizedListing {
  const r = parseDetail(fixture(name));
  if (r === null) throw new Error(`${name} parsed to null`);
  return r;
}

/** Minimal synthetic detail page for cases the fixtures do not cover. */
function page(opts: { h2?: string; body?: string; mls?: string } = {}): string {
  return `<html><body><div id="content">
    <div class="heading P-Heading"><div class="P-FloatL"><h2>${opts.h2 ?? "1 Main St<br />Honolulu, HI 96816"}</h2></div>
      <div class="sub-heading">
        <div class="status-box"><div id="ctl00_main_ctl00_divListStatus" class="active-box">Active</div></div>
        <div class="price-box"><span class="text">List <span>Price</span></span><div class="price"><span>$569,900.00 (FS)</span></div></div>
      </div>
    </div>
    <dl><dt>MLS #:</dt><dd>${opts.mls ?? "202600001"}</dd></dl>
    ${opts.body ?? ""}
  </div></body></html>`;
}

describe("hicentral parseDetail — fixtures", () => {
  test("there are 9 detail fixtures", () => {
    expect(DETAIL_FIXTURES).toHaveLength(9);
  });

  test("not-found page → null", () => {
    expect(parseDetail(fixture("detail-not-found-999999999.html"))).toBeNull();
  });

  test("sold single-family: both prices, sold date, schools, no agent block", () => {
    const r = parsed("detail-sf-sold-202521649.html");
    expect(r.mlsBoard).toBe("HBR");
    expect(r.mlsNumber).toBe("202521649");
    expect(r.status).toBe("sold");
    expect(r.statusRaw).toBe("Sold");
    expect(r.fields).toMatchObject({
      list_price: 1299000,
      sold_price: 1160000,
      tenure: "FS",
      address: "91-1879 Olali St",
      city: "Ewa Beach",
      state: "HI",
      zip: "96706",
      property_type: "Single Family",
      bedrooms: 4,
      full_baths: 3,
      half_baths: 0,
      land_area_sf: 5063,
      living_sf: 1854,
      lanai_sf: null,
      other_sf: 65,
      parking_stalls: 4,
      parking_stalls_desc: "3 Car+",
      island: "Oahu",
      region: "Ewa Plain",
      neighborhood: "EWA GEN MAKAMAE",
      tmk: "1-9-1-185-047-0000",
      list_date: "2025-10-03",
      date_sold: "2026-02-02",
      zoning: "5 - R-5 Residential",
      furnished: "None",
      year_built: 2022,
      year_remodeled: null,
      assd_val_land: 619500,
      assd_val_imprv: 473300,
      assd_val_total: 1092800,
      tax_year: 2025,
      monthly_taxes: 422,
      home_exempt: "$0",
      maintenance_fees: null,
      association_fees: 50,
      other_fees: null,
      elem_school: "Holomua",
      middle_school: "Ewa Makai",
      high_school: "Campbell",
      roofing: "Asphalt Shingle",
      set_backs: "C&C, Of Record",
      land_recorded: "Regular System",
      // Sold pages carry no listing-agent block.
      listing_agent: null,
      listing_office: null,
    });
    expect(r.fields.remarks).toStartWith(
      "Welcome to Ewa by Gentry – Makamae, where pride of ownership",
    );
    expect(r.fields.open_house).toBeUndefined();
    expect(r.extra).toEqual({});
  });

  test("active condo (Molokai): building name split from the address", () => {
    const r = parsed("detail-condo-active-202615118.html");
    expect(r.mlsNumber).toBe("202615118");
    expect(r.status).toBe("active");
    expect(r.fields).toMatchObject({
      list_price: 249000,
      sold_price: null,
      tenure: "FS",
      address: "255 Kepuhi Pl #20B12-2146",
      city: "Maunaloa",
      state: "HI",
      zip: "96770",
      property_type: "Condo/Townhouse",
      bedrooms: 0,
      full_baths: 1,
      land_area_sf: 509652,
      living_sf: 348,
      parking_stalls: 2,
      parking_stalls_desc: "Open, Open - 1",
      island: "Molokai",
      region: "Molokai",
      neighborhood: "Molokai West",
      tmk: "2-5-1-003-006-0140",
      list_date: "2026-08-11",
      furnished: "Full",
      year_built: 1978,
      year_remodeled: 1999,
      home_exempt: "AVAILABLE",
      maintenance_fees: 7,
      association_fees: 632,
      other_fees: null,
      number_of_stories: "Two",
      building_style: "Condotel, Walk-Up",
      listing_agent: "Kevin Donnelly",
      listing_office: "Oahu Realty",
    });
    expect(r.fields.date_sold).toBeUndefined();
    expect(r.fields.building_name).toBe("West Molokai Resort");
    expect(r.extra).toEqual({});
  });

  test("leasehold condo: LH tenure and the leasehold block (keys without colons)", () => {
    const r = parsed("detail-condo-leasehold-202606877.html");
    expect(r.mlsNumber).toBe("202606877");
    expect(r.fields).toMatchObject({
      list_price: 108000,
      tenure: "LH",
      address: "425 Ena Rd #302B",
      city: "Honolulu",
      zip: "96815",
      // The page's <time datetime="2026-00-06"> attribute is wrong; the text is right.
      list_date: "2026-04-06",
      lanai_sf: 0,
      parking_stalls: 0,
      parking_stalls_desc: "None, Street",
      maintenance_fees: 727,
      association_fees: null,
      other_fees: 54,
      land_tenure: "Leasehold",
      fee_options: "None",
      lessor: "James K. Woosley",
      lease_rent: "634.09/2048",
      next_step_up: "$735/--",
      second_step_up: null,
      fee_purchase: null,
      reneg_date: null,
      lease_exp: null,
      number_of_stories: "8-14",
      listing_agent: "Ben Eger",
      listing_office: "One Ohana Properties Inc",
    });
    expect(r.fields.building_name).toBe("Kalia");
    expect(r.extra).toEqual({});
  });

  test("multi-family: unit mix instead of bedrooms/baths", () => {
    const r = parsed("detail-multi-family-202609730.html");
    expect(r.mlsNumber).toBe("202609730");
    expect(r.status).toBe("pending");
    expect(r.fields).toMatchObject({
      property_type: "Multi-Family",
      studio_units: 0,
      one_bed_units: 1,
      two_bed_units: 4,
      three_bed_units: 0,
      land_area_sf: 4027,
      living_sf: null,
      parking_stalls: 5,
      parking_stalls_desc: "Covered, Open",
      list_price: 1100000,
      address: "1923 Kalani St",
      monthly_taxes: 1490,
      home_exempt: null,
      listing_agent: "Maurice Rodrigues",
      listing_office: "Real Broker",
    });
    expect(r.fields.bedrooms).toBeUndefined();
    expect(r.fields.full_baths).toBeUndefined();
    expect(r.fields.land_tenure).toBeUndefined();
  });

  test("repeated PUBLIC keys join into open_house — date and time only", () => {
    const r = parsed("detail-open-house-multi-202615174.html");
    expect(r.mlsNumber).toBe("202615174");
    expect(r.fields.open_house).toBe(
      [
        "Friday, September 18, 2026 10:00 AM - 5:00 PM",
        "Saturday, September 19, 2026 10:00 AM - 5:00 PM",
        "Sunday, September 20, 2026 10:00 AM - 5:00 PM",
        "Monday, September 21, 2026 10:00 AM - 5:00 PM",
        "Tuesday, September 22, 2026 10:00 AM - 5:00 PM",
        "Wednesday, September 23, 2026 10:00 AM - 5:00 PM",
        "Thursday, September 24, 2026 10:00 AM - 5:00 PM",
      ].join("; "),
    );
    // Primary agent only, not the co-listing agent.
    expect(r.fields.listing_agent).toBe("Renee Danielle Ricafrente");
    expect(r.fields.listing_office).toBe("D R Horton Hawaii, LLC");
    // New construction: zeros are values, a "0" tax year is not.
    expect(r.fields.assd_val_total).toBe(0);
    expect(r.fields.tax_year).toBeNull();
    expect(r.fields.year_built).toBe(2026);
    expect(r.fields.building_name).toBe("Kapili at Hoopili");
    expect(r.extra).toEqual({
      "Virtual Tour": "https://player.vimeo.com/video/1102767270",
    });
  });

  test("active under contract", () => {
    const r = parsed("detail-under-contract-202616519.html");
    expect(r.mlsNumber).toBe("202616519");
    expect(r.status).toBe("active_under_contract");
    expect(r.statusRaw).toBe("Active Under Contract");
    expect(r.fields).toMatchObject({
      list_price: 589000,
      address: "15-2069 31st Ave",
      city: "Keaau",
      zip: "96749",
      island: "Hawaii",
      region: "Puna",
      land_area_sf: 43560,
      listing_office: "Nathalie Mullinix R. U., Inc.",
    });
    // "&amp;" in the remarks decodes to a bare ampersand.
    expect(r.fields.remarks).toContain(
      "Buyer to confirm all & hold all parties",
    );
  });

  test("pending", () => {
    const r = parsed("detail-pending-202616112.html");
    expect(r.mlsNumber).toBe("202616112");
    expect(r.status).toBe("pending");
    expect(r.statusRaw).toBe("Pending");
    expect(r.fields).toMatchObject({
      list_price: 1165100,
      address: "91-3475 Kamaliehope St #144",
      city: "Ewa Beach",
      bedrooms: 5,
      maintenance_fees: 103,
      association_fees: 88,
      listing_agent: "Jurel S Shinjo-Mattison",
    });
  });

  test("neighbor island listing still carries a 9-digit HBR number", () => {
    const r = parsed("detail-neighbor-island-hawaii-202616348.html");
    expect(r.mlsBoard).toBe("HBR");
    expect(r.mlsNumber).toBe("202616348");
    expect(r.fields).toMatchObject({
      island: "Hawaii",
      region: "South Kohala",
      neighborhood: "WAIKOLOA",
      tmk: "3-6-8-003-002-0051",
      address: "68-3831 Lua Kula St #E104",
      city: "Waikoloa",
      zip: "96738",
      zoning: "Neighbor Island - See Remarks",
      parking_stalls: 1,
      parking_stalls_desc: "Assigned, Covered - 1, Guest",
      home_exempt: "$90,000",
      listing_office: "Compass",
    });
  });
});

describe("hicentral parseDetail — column spec coverage", () => {
  const all = DETAIL_FIXTURES.map((f) => ({ file: f, listing: parsed(f) }));

  test("every hicentralKey in MLS_COLUMNS is reachable", () => {
    // Reachable = the key occurs as a <dt> in at least one fixture AND the
    // parser wrote its column (possibly null, for a "--" value).
    const seen = new Set<string>();
    for (const { listing } of all) {
      for (const k of Object.keys(listing.fields)) seen.add(k);
    }
    const unreachable = MLS_COLUMNS.filter(
      (s) => s.hicentralKey !== null && !seen.has(s.column),
    ).map((s) => `${s.hicentralKey} → ${s.column}`);
    expect(unreachable).toEqual([]);
  });

  test("every column, header ones included, is populated by some fixture", () => {
    const filled = new Set<string>();
    for (const { listing } of all) {
      for (const [k, v] of Object.entries(listing.fields)) {
        if (v !== null && v !== undefined) filled.add(k);
      }
    }
    // Present as <dt> keys but "--" in every fixture. The four lease columns
    // have no filled example anywhere in the 265-page survey corpus either;
    // `exclusions` is filled on 24 of those pages, just not on a fixture.
    const neverFilledInFixtures = [
      "exclusions",
      "second_step_up",
      "fee_purchase",
      "reneg_date",
      "lease_exp",
    ];
    expect(MLS_COLUMN_NAMES.filter((c) => !filled.has(c)).sort()).toEqual(
      neverFilledInFixtures.sort(),
    );
  });

  test("fields only ever uses known column names", () => {
    const known = new Set<string>(MLS_COLUMN_NAMES);
    for (const { listing } of all) {
      expect(Object.keys(listing.fields).filter((k) => !known.has(k))).toEqual(
        [],
      );
    }
  });

  test("no <dt> key leaks into extra across all 8 fixtures", () => {
    // `extra` may hold the header facts that have no column (building name,
    // sale conditions, virtual tour) — never a dt/dd key.
    const allowed = new Set<string>(HICENTRAL_HEADER_EXTRA_KEYS);
    const leaked: Record<string, string[]> = {};
    for (const { file, listing } of all) {
      const keys = Object.keys(listing.extra).filter((k) => !allowed.has(k));
      if (keys.length > 0) leaked[file] = keys;
    }
    expect(leaked).toEqual({});
  });

  test("no agent contact details anywhere in the output", () => {
    for (const { listing } of all) {
      const blob = JSON.stringify(listing);
      expect(blob).not.toContain("email");
      expect(blob).not.toContain("Phone:");
      expect(blob).not.toMatch(/\b808[-. ]\d{3}[-. ]\d{4}\b/);
    }
  });

  test("no undecoded entities anywhere in the output", () => {
    for (const { listing } of all) {
      expect(JSON.stringify(listing)).not.toMatch(
        /&(#\d+|#x[0-9a-f]+|amp|nbsp|quot|apos);/i,
      );
    }
  });
});

describe("hicentral parseDetail — edge cases", () => {
  test("a page with no MLS # that is not the not-found page throws", () => {
    expect(() => parseDetail(fixture("list-oahu-active-p1.html"))).toThrow(
      MlsParseError,
    );
    expect(() =>
      parseDetail("<html><body>Service Unavailable</body></html>"),
    ).toThrow(MlsParseError);
    expect(() => parseDetail("")).toThrow(MlsParseError);
  });

  test("an MLS # that is not 9 digits throws", () => {
    expect(() => parseDetail(page({ mls: "123456" }))).toThrow(MlsParseError);
    expect(() => parseDetail(page({ mls: "--" }))).toThrow(MlsParseError);
  });

  test("header parsing on a minimal page; cents are rounded away", () => {
    const r = parseDetail(page())!;
    expect(r.mlsNumber).toBe("202600001");
    expect(r.status).toBe("active");
    expect(r.fields).toMatchObject({
      list_price: 569900,
      sold_price: null,
      tenure: "FS",
      address: "1 Main St",
      city: "Honolulu",
      state: "HI",
      zip: "96816",
      remarks: null,
      listing_agent: null,
      listing_office: null,
    });
    expect(r.extra).toEqual({});
  });

  test("address header tolerates a missing second line", () => {
    const r = parseDetail(page({ h2: "4819 Kahala Ave #C" }))!;
    expect(r.fields).toMatchObject({
      address: "4819 Kahala Ave #C",
      city: null,
      state: null,
      zip: null,
    });
  });

  test("'Address unavailable' is null, not an address", () => {
    const r = parseDetail(page({ h2: "Address unavailable" }))!;
    expect(r.fields.address).toBeNull();
    expect(r.fields.city).toBeNull();
  });

  test("entities: single-, double-encoded and &nbsp;", () => {
    const r = parseDetail(
      page({
        h2: "12 O&#39;Neil&nbsp;St<br />Hale&#39;iwa, HI 96712",
        body: `<div class="text-block"><h3>REMARKS:</h3>
          <p>Seller&amp;#39;s  favorite &amp; best&nbsp;home</p></div>
          <dl><dt>Lessor:</dt><dd>B&amp;B Trust</dd><dt>Set-Backs: </dt><dd>C&C</dd></dl>`,
      }),
    )!;
    expect(r.fields.address).toBe("12 O'Neil St");
    expect(r.fields.city).toBe("Hale'iwa");
    expect(r.fields.remarks).toBe("Seller's favorite & best home");
    expect(r.fields.lessor).toBe("B&B Trust");
    expect(r.fields.set_backs).toBe("C&C");
  });

  test("unknown dt keys land in extra verbatim; '--' is skipped; Sale Conditions is a column", () => {
    const r = parseDetail(
      page({
        body: `<dl><dt>Flood Zone: </dt><dd> Zone X </dd>
          <dt>Mystery:</dt><dd>--</dd></dl>
          <div class="text-block"><h3>Sale Conditions:</h3><p>Foreclosure</p></div>`,
      }),
    )!;
    expect(r.extra).toEqual({ "Flood Zone": "Zone X" });
    expect(r.fields.sale_conditions).toBe("Foreclosure");
  });

  test("parking with a bare number / no number", () => {
    const bare = parseDetail(
      page({ body: "<dl><dt>Parking Stalls: </dt><dd>2</dd></dl>" }),
    )!;
    expect(bare.fields.parking_stalls).toBe(2);
    expect(bare.fields.parking_stalls_desc).toBeNull();
    const none = parseDetail(
      page({ body: "<dl><dt>Parking Stalls: </dt><dd>Street</dd></dl>" }),
    )!;
    expect(none.fields.parking_stalls).toBeNull();
    expect(none.fields.parking_stalls_desc).toBe("Street");
  });
});
