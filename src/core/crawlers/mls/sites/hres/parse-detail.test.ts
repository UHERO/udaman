import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { MLS_COLUMN_NAMES, MLS_COLUMNS } from "../../columns";
import { MlsParseError } from "../../types";
import type { NormalizedListing } from "../../types";
import {
  countyDigitFromGeo,
  formatTmk,
  HRES_DERIVED_EXTRA_KEYS,
  HRES_KEY_MAP,
  islandFromGeo,
  islandFromTmk,
  normalizePropertyType,
  parseDetail,
} from "./parse-detail";

const FIXTURES = join(import.meta.dir, "fixtures");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

const NOT_FOUND = "detail-not-found-399999.html";
const DETAIL_FIXTURES = readdirSync(FIXTURES)
  .filter((f) => f.startsWith("detail-") && f !== NOT_FOUND)
  .sort();

function must(r: NormalizedListing | null): NormalizedListing {
  if (r === null) throw new Error("parsed to null");
  return r;
}
const parsed = (name: string) => must(parseDetail(fixture(name)));

/**
 * Every `extra` key the fixtures are allowed to produce. A new key showing up
 * here means the site added a field: decide whether it deserves a column.
 */
const EXTRA_ALLOW_LIST = [
  "# of Garages",
  "Acres",
  "Cooling",
  "Fireplace",
  "Foundation",
  "HOA Fees Freq.",
  "Interior Features",
  "Latitude",
  "Longitude",
  "Sub-Type",
  "Type",
  "Utilities",
  "Windows",
];

// ── Synthetic pages ─────────────────────────────────────────────────────

const CDN = "https://feed-images.rewhosting.com";
const PHOTO = {
  HBR: `${CDN}/trestle_webapi_plus/PHOTO/Property/1191110699/1-a-o.webp`,
  HIS: `${CDN}/his_acortez/Photo/Property/733542/1-a-o.jpg`,
  RAM: `${CDN}/ramaui/Photo/Property/abc/1-a-o.webp`,
  none: "https://www.hawaiirealestatesearch.com/img/no-image.jpg",
};
const DISCLAIMER = {
  HBR: "Based on information from the Multiple Listing Service of the HiCentral MLS&reg;, Ltd. active listings last updated on September 19th, 2026.",
  HIS: "IDX and Information provided herein is deemed reliable but is not guaranteed by the Hawaii Information Service, Inc. Listing Service.",
  RAM: "Listings provided courtesy of the REALTORS&reg; Association of Maui. ",
  boilerplate: "Listing information last updated on September 19th, 2026.",
};

const kv = (k: string, v: string) =>
  `<div class="keyval"><strong class="keyval__key">${k}</strong><span class="keyval__val">${v}</span></div>`;
const section = (header: string, body: string) =>
  `<div class="keyvals"><h2 class="listing-data__header">${header}</h2><div class="keyvals__body">${body}</div></div>`;
/** A value over 30 characters: the site renders header + paragraph. */
const longValue = (key: string, value: string) =>
  section(key, `<p><strong>${value}</strong></p>`);

const similarCard = (mls: string, photo: string) =>
  `<div id="listing-similar_1"><h3>Similar Properties You Might Like</h3><div class="listings cols">
     <div class=" article column " id="listing-${mls}">
       <a class="article__photo" href="https://www.hawaiirealestatesearch.com/listing/${mls}-9-leak-st/"><img class="lazy" data-src="${photo}"></a>
       <a class="save" data-save='{"div":"#listing-${mls}","mls":"${mls}"}'></a>
       <div class="keyvals"><h2 class="listing-data__header">Leak</h2><div class="keyvals__body">${kv("Bedrooms", "99")}${kv("Leaked Key", "leaked")}</div></div>
       <div class="condo-price-details">$9,999,999 - 9 Beds</div>
     </div></div></div>`;

interface PageOpts {
  mls?: string;
  jsonMls?: string;
  photo?: string;
  geo?: [string, string] | null;
  pairs?: Array<[string, string]>;
  sections?: string;
  tax?: string | null;
  disclaimers?: string[];
  similar?: string;
}

function page(o: PageOpts = {}): string {
  const mls = o.mls ?? "410001";
  const geo =
    o.geo === undefined ? ["20.984614000000", "-156.669862000000"] : o.geo;
  const listingJson = JSON.stringify({
    ...(geo ? { geo } : {}),
    mls: o.jsonMls ?? mls,
    feed: "hicentralhisramaui",
  });
  const essential = [
    kv("MLS&reg; #", mls),
    kv("Price", "$699,000"),
    kv("Status", "Active"),
    ...(o.pairs ?? []).map(([k, v]) => kv(k, v)),
  ].join("");
  const tax =
    o.tax === null
      ? ""
      : `<span class="countyTax"><a href="${o.tax ?? "https://qpublic.schneidercorp.com/Application.aspx?AppID=1029&LayerID=21689&PageTypeID=4&PageID=9251&KeyValue=430031100011"}">County Tax Information</a></span>`;
  const disclaimers = (o.disclaimers ?? [DISCLAIMER.RAM])
    .map(
      (d) => `<div class="mls-disclaimer"><p class="disclaimer">${d}</p></div>`,
    )
    .join("");
  return `<html><head><meta property="og:image" content="${o.photo ?? PHOTO.RAM}"></head><body>
    <div id="listing-details" data-listing='${listingJson}' class="container">
      <div class="data listing-data">
        <div id="tab-listingInformation">${section("Essential Information", essential)}${o.sections ?? ""}</div>
        <div id="tab-publicInformation" class="hidden"><div id="public-records-information" class="keyvals">${tax}</div></div>
      </div>
      ${o.similar ?? ""}
    </div>${disclaimers}</body></html>`;
}

const syn = (o: PageOpts = {}) => must(parseDetail(page(o)));

// ── Fixtures ────────────────────────────────────────────────────────────

describe("hres parseDetail — fixtures", () => {
  test("there are 9 detail fixtures", () => {
    expect(DETAIL_FIXTURES).toHaveLength(9);
  });

  test("HTTP-404 'Listing Not Found' page → null", () => {
    expect(parseDetail(fixture(NOT_FOUND))).toBeNull();
  });

  test("HBR condo: Full/Half Baths win over Bathrooms, Acres 0.00 → null, Oahu TMK", () => {
    expect(parsed("detail-hbr-condo-202617839.html")).toEqual({
      mlsBoard: "HBR",
      mlsNumber: "202617839",
      status: "active",
      statusRaw: "Active",
      fields: {
        list_price: 700000,
        bedrooms: 2,
        full_baths: 2,
        half_baths: 1,
        living_sf: 1271,
        land_area_sf: null,
        year_built: 1993,
        property_type: "Condo/Townhouse",
        tenure: "FS",
        land_tenure: "Fee Simple",
        address: "94-829 Lumiauau Street G102",
        region: "Waipahu",
        neighborhood: "WAIKELE",
        building_name: "Greens At Waikele",
        city: "Waipahu",
        island: "Oahu",
        state: "HI",
        zip: "96797",
        parking_stalls: 2,
        // Rendered as its own "Parking" section (value > 30 chars).
        parking_stalls_desc: "Covered, Garage, Guest, Two Spaces",
        view: "Golf Course",
        pool: "Yes", // only `Has Pool`
        number_of_stories: "Two",
        construction: "Double Wall, Concrete", // HBR `Exterior`
        frontage: "GolfCourse",
        association_fees: 65,
        maintenance_fees: 981, // 980.62
        listing_office: "Coldwell Banker Island Prop",
        // 940070460028 — HiCentral prints this listing as 1-9-4-007-046-0028.
        tmk: "1-9-4-007-046-0028",
      },
      extra: {
        Type: "Residential",
        "Sub-Type": "Condominium",
        Latitude: "21.404387",
        Longitude: "-158.000009",
      },
    });
  });

  test("HBR single family, no tax link: Interior/Exterior/Features renames, schools, no tmk", () => {
    const r = parsed("detail-hbr-no-tax-link-202613482.html");
    expect(r).toEqual({
      mlsBoard: "HBR",
      mlsNumber: "202613482",
      status: "active_under_contract",
      statusRaw: "Active Under Contract",
      fields: {
        list_price: 1149000,
        bedrooms: 11,
        full_baths: 6,
        living_sf: 2704,
        land_area_sf: 4792, // 0.11 ac
        year_built: 1906,
        property_type: "Single Family",
        tenure: "FS",
        land_tenure: "Fee Simple",
        building_style: "Detached",
        address: "1015 Noble Lane",
        region: "Metro",
        neighborhood: "KAPALAMA",
        city: "Honolulu",
        island: "Oahu", // County
        state: "HI",
        zip: "96817",
        parking_stalls: 6,
        parking_stalls_desc: "Three or more Spaces",
        view: "None",
        pool: "None",
        floor_covering: "Ceramic Tile, Hardwood", // `Interior`
        construction: "Concrete, Single Wall", // `Construction` (= `Exterior`)
        lot_description: "Cleared, Interior Lot, Level", // (= `Features`)
        elem_school: "Likelike",
        middle_school: "Keelikolani",
        high_school: "Mckinley",
        list_date: "2026-07-13",
        listing_office: "Five Star Realty, Inc.",
      },
      extra: {
        Acres: "0.11",
        Type: "Residential",
        "Sub-Type": "Single Family Residence",
        Utilities:
          "Above Ground Utilities, Cable Available, Electricity Available, High Speed Internet Available, Other, Water Available",
        Latitude: "21.3268838",
        Longitude: "-157.8659823",
      },
    });
    expect("tmk" in r.fields).toBe(false);
  });

  test("HIS single family: assessed value, district as city, Hawaii TMK", () => {
    expect(parsed("detail-his-single-family-733542.html")).toEqual({
      mlsBoard: "HIS",
      mlsNumber: "733542",
      status: "active",
      statusRaw: "Active",
      fields: {
        list_price: 495000,
        bedrooms: 3,
        full_baths: 2,
        living_sf: 1322,
        land_area_sf: 43560,
        year_built: 2004,
        property_type: "Single Family",
        tenure: "FS",
        land_tenure: "Fee Simple",
        assd_val_total: 330900,
        address: "15-1587 29th Ave",
        neighborhood: "HAWAIIAN PARADISE PARK",
        city: "Puna",
        state: "HI",
        zip: "96749",
        parking_stalls_desc: "Attached",
        floor_covering: "Carpet",
        list_date: "2026-09-18",
        zoning: "A-1A",
        maintenance_fees: 36, // 36.25
        listing_office: "Iokua Real Estate",
        tmk: "3-1-5-034-111-0000",
        island: "Hawaii",
      },
      extra: {
        Acres: "1.00",
        Type: "Residential",
        "Sub-Type": "Single Family Residence",
        "HOA Fees Freq.": "Monthly",
        Latitude: "19.57065466",
        Longitude: "-154.99312841",
      },
    });
  });

  test("HIS vacant land: no Sub-Type, Office rendered as its own section", () => {
    expect(parsed("detail-his-vacant-land-730446.html")).toEqual({
      mlsBoard: "HIS",
      mlsNumber: "730446",
      status: "active",
      statusRaw: "Active",
      fields: {
        list_price: 550000,
        land_area_sf: 872071, // 20.02 ac
        property_type: "Vacant Land",
        tenure: "FS",
        land_tenure: "Fee Simple",
        assd_val_total: 80100,
        address: "Paikio Rd",
        neighborhood: "KAUPAKUEA FARMS SUBDIVISION",
        city: "South Hilo",
        state: "HI",
        zip: "96783",
        view: "Ocean",
        lot_description: "Farm, Grassy",
        list_date: "2026-05-16",
        zoning: "A-20a",
        maintenance_fees: 38, // 37.50
        listing_office: "Big Island Homes & Land Co., Ltd.",
        tmk: "3-2-8-009-043-0000",
        island: "Hawaii",
      },
      extra: {
        Acres: "20.02",
        Type: "Vacant Land",
        "HOA Fees Freq.": "Monthly",
        Latitude: "19.84277796",
        Longitude: "-155.10790772",
      },
    });
  });

  test("HIS commercial on Kauai: Kauai TMK with a CPR number, Building Name section", () => {
    expect(parsed("detail-his-commercial-720819.html")).toEqual({
      mlsBoard: "HIS",
      mlsNumber: "720819",
      status: "active_under_contract",
      statusRaw: "Active Under Contract",
      fields: {
        list_price: 5500000,
        land_area_sf: 235224, // 5.40 ac
        property_type: "Commercial",
        tenure: "FS",
        land_tenure: "Fee Simple",
        address: "3-1480 Kaumualii Hwy 2",
        building_name: "KAUAI VETERANS TRUCKING CONDOMINIUM",
        city: "Lihue",
        state: "HI",
        zip: "96766",
        list_date: "2025-05-09",
        zoning: "A",
        listing_office: "Kauai Realty, Inc.",
        tmk: "4-3-3-002-011-9002",
        island: "Kauai",
      },
      extra: {
        Acres: "5.40",
        Type: "Commercial",
        "Sub-Type": "Warehouse",
        Latitude: "21.96179414",
        Longitude: "-159.40786555",
      },
    });
  });

  test("HIS listing with no photo, no tax link, no Land Tenure: board from the disclaimer, island from geo", () => {
    const r = parsed("detail-his-no-photo-733417.html");
    expect(r).toEqual({
      mlsBoard: "HIS",
      mlsNumber: "733417",
      status: "active",
      statusRaw: "Active",
      fields: {
        list_price: 165000,
        land_area_sf: 20038, // 0.46 ac
        property_type: "Farm",
        address: "94-6482 Palaoa Rd",
        neighborhood: "MARK TWAIN ESTATES",
        city: "Kau",
        state: "HI",
        zip: "96772",
        view: "Mountain(s), Ocean, Sunrise",
        lot_description: "Cleared, Interior Lot",
        list_date: "2026-09-18",
        zoning: "A-1A",
        listing_office: "Hawai'i Modern Realty",
        island: "Hawaii",
      },
      extra: {
        Acres: "0.46",
        Type: "Residential",
        "Sub-Type": "Farm",
        "HOA Fees Freq.": "Monthly",
        Latitude: "19.04112923",
        Longitude: "-155.62320175",
      },
    });
    for (const absent of ["tmk", "tenure", "land_tenure"]) {
      expect(absent in r.fields).toBe(false);
    }
  });

  test("RAM condo: Bathrooms-only split, Maui TMK, Waterfront 'None' dropped", () => {
    expect(parsed("detail-ram-condo-410851.html")).toEqual({
      mlsBoard: "RAM",
      mlsNumber: "410851",
      status: "active",
      statusRaw: "Active",
      fields: {
        list_price: 699000,
        bedrooms: 2,
        full_baths: 2, // Bathrooms 2.00
        half_baths: 0,
        living_sf: 894,
        land_area_sf: null, // RAM's 12.48 ac is the whole project — kept only in extra.Acres
        year_built: 2001,
        property_type: "Condo/Townhouse",
        tenure: "FS",
        land_tenure: "Fee Simple",
        building_style: "Low-Rise 1-3 Stories",
        address: "10 Polohina Ln, Unit 2-3",
        region: "Napili/Kahana/Honokowai",
        neighborhood: "Napili Villas",
        building_name: "Napili Villas",
        city: "Napili/Kahana/Honokowai",
        state: "HI",
        zip: "96761",
        view: "Ocean",
        inclusions: "Dryer, Microwave, Range, Refrigerator, Washer",
        roofing: "Asphalt/Comp Shingle",
        list_date: "2026-09-19",
        zoning: "Apartment District",
        maintenance_fees: 588,
        listing_office: "Compass",
        tmk: "2-4-3-003-110-0011",
        island: "Maui",
      },
      extra: {
        Acres: "12.48",
        Type: "Condo / Townhouse",
        "Sub-Type": "Condominium",
        Utilities: "Phone Connected, Cable Connected",
        "Interior Features": "Ceiling Fan(s), TV Cable",
        Windows: "Blinds",
        Foundation: "Pillar/Post/Pier",
        Latitude: "20.984614",
        Longitude: "-156.669862",
      },
    });
  });

  test("RAM leasehold: tenure LH, lease fee + expiry kept as text", () => {
    expect(parsed("detail-ram-leasehold-410844.html")).toEqual({
      mlsBoard: "RAM",
      mlsNumber: "410844",
      status: "active",
      statusRaw: "Active",
      fields: {
        list_price: 725000,
        bedrooms: 3,
        full_baths: 2,
        half_baths: 0,
        living_sf: 1160,
        land_area_sf: 7841, // 0.18 ac
        year_built: 2006,
        property_type: "Single Family",
        tenure: "LH",
        land_tenure: "Leasehold",
        address: "34 Mauli Ola St",
        region: "Wailuku",
        neighborhood: "Waiehu Kou 3",
        city: "Wailuku",
        state: "HI",
        zip: "96793",
        parking_stalls_desc: "Garage",
        view: "Mountain(s)",
        number_of_stories: "One",
        inclusions:
          "Dishwasher, Disposal, Dryer, Microwave, Range, Refrigerator, Solar Hot Water, Washer",
        roofing: "Asphalt/Comp Shingle",
        list_date: "2026-09-18",
        // The page prints both `Monthly Lease Fee` and `Monthly Lease Fees`.
        lease_rent: "$100",
        lease_exp: "March 18th, 2057",
        listing_office: "Keller Williams Realty Maui-L",
        tmk: "2-3-2-024-046-0000",
        island: "Maui",
      },
      extra: {
        Acres: "0.18",
        Type: "Residential",
        "Sub-Type": "Single Family Residence",
        "# of Garages": "2",
        Cooling: "Central Air",
        "Interior Features": "Ceiling Fan(s), TV Cable, Remodeled",
        Windows: "Blinds",
        Foundation: "Slab",
        Latitude: "20.927323",
        Longitude: "-156.504514",
      },
    });
  });

  test("RAM listing in Kula whose tax link points at Hawaii County's app: geo sets the island digit", () => {
    const html = fixture("detail-ram-wrong-county-app-410825.html");
    // The page really does say AppID=1048 (Hawaii County) for a Maui parcel.
    expect(html).toContain("AppID=1048");
    expect(html).toContain("KeyValue=220040870000");
    expect(parseDetail(html)).toEqual({
      mlsBoard: "RAM",
      mlsNumber: "410825",
      status: "active",
      statusRaw: "Active",
      fields: {
        list_price: 1484000,
        bedrooms: 2,
        full_baths: 2,
        half_baths: 0,
        living_sf: 1460,
        land_area_sf: 94525, // 2.17 ac
        year_built: 1995,
        property_type: "Single Family",
        tenure: "FS",
        land_tenure: "Fee Simple",
        address: "1587 Polipoli Rd",
        region: "Kula/Ulupalakua/Kanaio",
        city: "Kula/Ulupalakua/Kanaio",
        state: "HI",
        zip: "96760", // agent typo (Kula is 96790) — what misled the site
        parking_stalls_desc: "Garage",
        view: "Mountain/Ocean",
        number_of_stories: "One",
        inclusions: "Dishwasher, Dryer, Range, Refrigerator, Washer",
        lot_description: "Irregular",
        roofing: "Asphalt/Comp Shingle",
        list_date: "2026-09-16",
        listing_office: "Island Sotheby's International Realty(M)",
        tmk: "2-2-2-004-087-0000",
        island: "Maui",
      },
      extra: {
        Acres: "2.17",
        Type: "Residential",
        "Sub-Type": "Single Family Residence",
        "# of Garages": "2",
        Fireplace: "Yes",
        "Interior Features": "Ceiling Fan(s), Storage, Workshop",
        Windows: "Blinds",
        Foundation: "Pillar/Post/Pier",
        Latitude: "20.708089",
        Longitude: "-156.341947",
      },
    });
  });
});

describe("hres parseDetail — invariants over every fixture", () => {
  test.each(DETAIL_FIXTURES)("%s: fields only uses known columns", (name) => {
    for (const column of Object.keys(parsed(name).fields)) {
      expect(MLS_COLUMN_NAMES).toContain(column as never);
    }
  });

  test("columns this site cannot fill stay absent", () => {
    for (const name of DETAIL_FIXTURES) {
      const { fields } = parsed(name);
      for (const column of [
        "remarks",
        "listing_agent",
        "sold_price",
        "date_sold",
      ]) {
        expect(column in fields).toBe(false);
      }
    }
  });

  test("every distinct extra key is on the allow-list (and the list has no dead entries)", () => {
    const seen = new Set<string>();
    for (const name of DETAIL_FIXTURES) {
      for (const key of Object.keys(parsed(name).extra)) seen.add(key);
    }
    expect([...seen].sort()).toEqual([...EXTRA_ALLOW_LIST].sort());
    for (const key of HRES_DERIVED_EXTRA_KEYS) expect(seen).toContain(key);
  });

  test("Days on Market and Office Contact are dropped entirely — no phone numbers anywhere", () => {
    let sawContact = false;
    for (const name of DETAIL_FIXTURES) {
      sawContact ||= fixture(name).includes(">Office Contact<");
      const json = JSON.stringify(parsed(name));
      expect(json).not.toContain("Days on Market");
      expect(json).not.toContain("Office Contact");
      expect(json).not.toMatch(/\(?808\)?[-. ]\d{3}[-.]\d{4}/);
      const contact =
        />Office Contact<\/strong><span class="keyval__val">([^<]*)</.exec(
          fixture(name),
        );
      if (contact) expect(json).not.toContain(contact[1].replace(/^\D+/, ""));
    }
    expect(sawContact).toBe(true);
  });

  test.each(DETAIL_FIXTURES)(
    "%s: similar-listings cards never leak into the result",
    (name) => {
      const html = fixture(name);
      const r = parsed(name);
      const json = JSON.stringify(r);
      const cardIds = [...html.matchAll(/id="listing-(\d+)"/g)].map(
        (m) => m[1],
      );
      for (const id of cardIds) {
        expect(id).not.toBe(r.mlsNumber);
        expect(json).not.toContain(id);
      }
      // Cutting the whole similar-listings block out changes nothing.
      const start = html.indexOf('<div id="listing-similar_1"');
      if (cardIds.length === 0) {
        expect(start).toBe(-1);
        return;
      }
      const end = html.indexOf('<div class="mls-disclaimer">');
      expect(start).toBeGreaterThan(0);
      expect(end).toBeGreaterThan(start);
      expect(parseDetail(html.slice(0, start) + html.slice(end))).toEqual(r);
    },
  );

  test("the fixtures do contain cards from another board than the listing's", () => {
    // HIS listing, third card is HBR; RAM listing, second card is HBR.
    expect(fixture("detail-his-single-family-733542.html")).toContain(
      'id="listing-202617280"',
    );
    expect(fixture("detail-ram-leasehold-410844.html")).toContain(
      'id="listing-202614343"',
    );
    expect(fixture("detail-ram-wrong-county-app-410825.html")).toContain(
      "his_acortez",
    );
  });
});

// ── Board detection ─────────────────────────────────────────────────────

describe("hres parseDetail — board", () => {
  test.each([
    ["HBR", PHOTO.HBR, "202617812"],
    ["HIS", PHOTO.HIS, "733542"],
    ["RAM", PHOTO.RAM, "410851"],
  ] as const)("og:image CDN path → %s", (board, photo, mls) => {
    // Disclaimer deliberately names another board: the photo wins.
    const other = board === "HIS" ? DISCLAIMER.RAM : DISCLAIMER.HIS;
    expect(syn({ mls, photo, disclaimers: [other] }).mlsBoard).toBe(board);
  });

  test("gallery data-photos / slideshow are read when og:image is the placeholder", () => {
    const base = page({ photo: PHOTO.none, disclaimers: [DISCLAIMER.RAM] });
    const gallery = base.replace(
      "<body>",
      `<body><div id="fgallery_1" data-photos='[{"src":"https:\\/\\/feed-images.rewhosting.com\\/his_acortez\\/Photo\\/Property\\/1\\/0-a-o.jpg","w":640}]'></div>`,
    );
    expect(must(parseDetail(gallery)).mlsBoard).toBe("HIS");
    const slides = base.replace(
      "<body>",
      `<body><div id="slideshow_1"><div class="slide active" style="background-image: url('${PHOTO.HIS}');"></div></div>`,
    );
    expect(must(parseDetail(slides)).mlsBoard).toBe("HIS");
  });

  test("no-photo fixture falls back to its first disclaimer", () => {
    const html = fixture("detail-his-no-photo-733417.html");
    expect(html).not.toContain("feed-images.rewhosting.com");
    expect(must(parseDetail(html)).mlsBoard).toBe("HIS");
  });

  test.each([
    ["detail-his-single-family-733542.html", "HIS", "HiCentral MLS"],
    ["detail-ram-leasehold-410844.html", "RAM", "HiCentral MLS"],
    [
      "detail-ram-wrong-county-app-410825.html",
      "RAM",
      "Hawaii Information Service",
    ],
  ] as const)(
    "%s without its photos: FIRST disclaimer (%s) wins over a later one naming another board",
    (name, board, laterBoardText) => {
      const html = fixture(name);
      const first = html.indexOf('<p class="disclaimer">');
      expect(html.indexOf(laterBoardText, first)).toBeGreaterThan(first);
      // Knocks out the listing's photos AND the cards' — only disclaimers remain.
      const noPhotos = html.replaceAll(
        "feed-images.rewhosting.com",
        "cdn.invalid",
      );
      expect(must(parseDetail(noPhotos)).mlsBoard).toBe(board);
    },
  );

  test("a similar-listings card photo is never taken for the listing's own", () => {
    const r = syn({
      mls: "733417",
      photo: PHOTO.none,
      disclaimers: [DISCLAIMER.HIS, DISCLAIMER.RAM],
      similar: similarCard("410827", PHOTO.RAM),
    });
    expect(r.mlsBoard).toBe("HIS");
  });

  test("boilerplate disclaimers are skipped when looking for the first board", () => {
    const r = syn({
      photo: PHOTO.none,
      disclaimers: [DISCLAIMER.boilerplate, DISCLAIMER.RAM, DISCLAIMER.HIS],
    });
    expect(r.mlsBoard).toBe("RAM");
  });

  test("photo-less 9-digit number is HBR even when the first disclaimer is another board's", () => {
    // Seen live: HBR 202617812 (Big Island) lists the HIS block first.
    const r = syn({
      mls: "202617812",
      photo: PHOTO.none,
      disclaimers: [DISCLAIMER.HIS, DISCLAIMER.HBR],
    });
    expect(r.mlsBoard).toBe("HBR");
  });

  test("photo-less 6-digit number whose first disclaimer is HBR → MlsParseError, not a guess", () => {
    expect(() =>
      parseDetail(
        page({
          photo: PHOTO.none,
          disclaimers: [DISCLAIMER.HBR, DISCLAIMER.RAM],
        }),
      ),
    ).toThrow(MlsParseError);
  });

  test("no photo and no board disclaimer → MlsParseError", () => {
    expect(() =>
      parseDetail(
        page({ photo: PHOTO.none, disclaimers: [DISCLAIMER.boilerplate] }),
      ),
    ).toThrow(/cannot tell which MLS/);
  });
});

// ── TMK / island ────────────────────────────────────────────────────────

describe("hres TMK + island", () => {
  test("formatTmk groups I-Z-S-PPP-ppp-CCCC", () => {
    expect(formatTmk(1, "940070460028")).toBe("1-9-4-007-046-0028");
    expect(formatTmk(2, "430031100011")).toBe("2-4-3-003-110-0011");
    expect(formatTmk(3, "150341110000")).toBe("3-1-5-034-111-0000");
    expect(formatTmk(4, "330020119002")).toBe("4-3-3-002-011-9002");
    expect(() => formatTmk(1, "94007046002")).toThrow();
    expect(() => formatTmk(5, "940070460028")).toThrow();
  });

  test("one fixture per county", () => {
    const tmk = (name: string) => parsed(name).fields.tmk;
    expect(tmk("detail-hbr-condo-202617839.html")).toBe("1-9-4-007-046-0028");
    expect(tmk("detail-ram-condo-410851.html")).toBe("2-4-3-003-110-0011");
    expect(tmk("detail-his-single-family-733542.html")).toBe(
      "3-1-5-034-111-0000",
    );
    expect(tmk("detail-his-commercial-720819.html")).toBe("4-3-3-002-011-9002");
  });

  test("islandFromTmk: Maui County splits into Maui / Molokai / Lanai", () => {
    expect(islandFromTmk("1-9-4-007-046-0028")).toBe("Oahu");
    expect(islandFromTmk("3-1-5-034-111-0000")).toBe("Hawaii");
    expect(islandFromTmk("4-3-3-002-011-9002")).toBe("Kauai");
    expect(islandFromTmk("2-4-3-003-110-0011")).toBe("Maui");
    expect(islandFromTmk("2-5-3-003-024-0000")).toBe("Molokai");
    expect(islandFromTmk("2-4-9-011-018-0000")).toBe("Lanai");
    expect(islandFromTmk("2-4-8-003-010-0000")).toBe("Maui"); // zone 4, not sec 9
    expect(islandFromTmk("2-1-9-001-001-0000")).toBe("Maui"); // sec 9, not zone 4
    expect(islandFromTmk(null)).toBeNull();
    expect(islandFromTmk("9-1-1-001-001-0000")).toBeNull();
  });

  test("Molokai listing (none in the corpus — synthetic): Maui County app, zone 5", () => {
    const r = syn({
      geo: ["21.090100000000", "-157.010500000000"],
      tax: "https://qpublic.schneidercorp.com/Application.aspx?AppID=1029&LayerID=21689&PageTypeID=4&PageID=9251&KeyValue=530030240000",
    });
    expect(r.fields.tmk).toBe("2-5-3-003-024-0000");
    expect(r.fields.island).toBe("Molokai");
  });

  test("Lanai listing (synthetic): zone 4 section 9", () => {
    const r = syn({
      geo: ["20.827000000000", "-156.920000000000"],
      tax: "https://qpublic.schneidercorp.com/Application.aspx?AppID=1029&KeyValue=490110180000",
    });
    expect(r.fields.tmk).toBe("2-4-9-011-018-0000");
    expect(r.fields.island).toBe("Lanai");
  });

  test("County, when the page has one, is used verbatim", () => {
    const r = syn({
      mls: "202617812",
      photo: PHOTO.HBR,
      pairs: [["County", "Hawaii"]],
    });
    expect(r.fields.island).toBe("Hawaii");
  });

  test("&amp;-escaped tax href still parses", () => {
    const r = syn({
      tax: "https://qpublic.schneidercorp.com/Application.aspx?AppID=1029&amp;LayerID=21689&amp;KeyValue=430031100011",
    });
    expect(r.fields.tmk).toBe("2-4-3-003-110-0011");
  });

  test("no geo: the AppID decides the island digit", () => {
    const r = syn({
      geo: null,
      tax: "https://qpublic.schneidercorp.com/Application.aspx?AppID=986&KeyValue=330020119002",
    });
    expect(r.fields.tmk).toBe("4-3-3-002-011-9002");
    expect(r.fields.island).toBe("Kauai");
    expect("Latitude" in r.extra).toBe(false);
    expect("Longitude" in r.extra).toBe(false);
  });

  test("no tax link, no County, no geo → neither tmk nor island", () => {
    const r = syn({ geo: null, tax: null });
    expect("tmk" in r.fields).toBe(false);
    expect("island" in r.fields).toBe(false);
  });

  test("a KeyValue that is not 12 digits, or an unknown app with no geo → no tmk", () => {
    const short = syn({
      tax: "https://qpublic.schneidercorp.com/Application.aspx?AppID=1029&KeyValue=43003110",
    });
    expect("tmk" in short.fields).toBe(false);
    const unknownApp = syn({
      geo: null,
      tax: "https://qpublic.schneidercorp.com/Application.aspx?AppID=7&KeyValue=430031100011",
    });
    expect("tmk" in unknownApp.fields).toBe(false);
  });

  test("a tax link inside a similar-listings card is ignored", () => {
    const r = syn({
      tax: null,
      similar: `<div class="article" id="listing-410827"><span class="countyTax"><a href="https://qpublic.schneidercorp.com/Application.aspx?AppID=1029&KeyValue=430031100011">County Tax Information</a></span></div>`,
    });
    expect("tmk" in r.fields).toBe(false);
  });

  test("countyDigitFromGeo / islandFromGeo", () => {
    expect(countyDigitFromGeo(21.3069, -157.8583)).toBe(1); // Honolulu
    expect(countyDigitFromGeo(21.6483, -157.9189)).toBe(1); // Laie
    expect(countyDigitFromGeo(20.8893, -156.4729)).toBe(2); // Kahului
    expect(countyDigitFromGeo(19.7241, -155.0868)).toBe(3); // Hilo
    expect(countyDigitFromGeo(20.2382, -155.8322)).toBe(3); // Hawi
    expect(countyDigitFromGeo(21.9811, -159.3711)).toBe(4); // Lihue
    expect(countyDigitFromGeo(0, 0)).toBeNull();
    expect(countyDigitFromGeo(37.77, -122.42)).toBeNull();
    expect(countyDigitFromGeo(Number.NaN, -157)).toBeNull();

    expect(islandFromGeo(20.8783, -156.6825)).toBe("Maui"); // Lahaina
    expect(islandFromGeo(21.0266, -156.6306)).toBe("Maui"); // Nakalele Point
    expect(islandFromGeo(20.7575, -155.9884)).toBe("Maui"); // Hana
    expect(islandFromGeo(21.0889, -157.0125)).toBe("Molokai"); // Kaunakakai
    expect(islandFromGeo(21.1578, -156.7364)).toBe("Molokai"); // Halawa
    expect(islandFromGeo(20.8275, -156.9208)).toBe("Lanai"); // Lanai City
    expect(islandFromGeo(20.7397, -156.8944)).toBe("Lanai"); // Manele
    expect(islandFromGeo(19.0411, -155.6232)).toBe("Hawaii");
    expect(islandFromGeo(22.2036, -159.4009)).toBe("Kauai");
    expect(islandFromGeo(0, 0)).toBeNull();
  });
});

// ── Field rules ─────────────────────────────────────────────────────────

describe("hres parseDetail — field rules", () => {
  test("Bathrooms splits only when Full/Half Baths are absent", () => {
    expect(syn({ pairs: [["Bathrooms", "2.50"]] }).fields).toMatchObject({
      full_baths: 2,
      half_baths: 1,
    });
    expect(syn({ pairs: [["Bathrooms", "3.00"]] }).fields).toMatchObject({
      full_baths: 3,
      half_baths: 0,
    });
    const split = syn({
      pairs: [
        ["Bathrooms", "2.50"],
        ["Full Baths", "1"],
      ],
    }).fields;
    expect(split.full_baths).toBe(1);
    expect("half_baths" in split).toBe(false);
    const halfOnly = syn({
      pairs: [
        ["Bathrooms", "0.50"],
        ["Half Baths", "1"],
      ],
    }).fields;
    expect(halfOnly.half_baths).toBe(1);
    expect("full_baths" in halfOnly).toBe(false);
  });

  test("Bathrooms 0.00 (multi-family, land) is a blank, not zero bathrooms", () => {
    const { fields, extra } = syn({ pairs: [["Bathrooms", "0.00"]] });
    expect("full_baths" in fields).toBe(false);
    expect("half_baths" in fields).toBe(false);
    expect("Bathrooms" in extra).toBe(false);
  });

  test("Acres → land_area_sf, raw kept only when non-zero", () => {
    const some = syn({ pairs: [["Acres", "1.25"]] });
    expect(some.fields.land_area_sf).toBe(54450);
    expect(some.extra.Acres).toBe("1.25");
    const big = syn({ pairs: [["Acres", "1,020.50"]] });
    expect(big.fields.land_area_sf).toBe(44452980);
    const zero = syn({ pairs: [["Acres", "0.00"]] });
    expect(zero.fields.land_area_sf).toBeNull();
    expect("Acres" in zero.extra).toBe(false);
  });

  test("normalizePropertyType", () => {
    expect(normalizePropertyType("Condo / Townhouse", "Condominium")).toBe(
      "Condo/Townhouse",
    );
    expect(normalizePropertyType("Residential", "Condominium")).toBe(
      "Condo/Townhouse",
    );
    expect(normalizePropertyType("Residential", "Townhouse")).toBe(
      "Condo/Townhouse",
    );
    expect(normalizePropertyType("Condo / Townhouse", null)).toBe(
      "Condo/Townhouse",
    );
    expect(
      normalizePropertyType("Residential", "Single Family Residence"),
    ).toBe("Single Family");
    expect(
      normalizePropertyType("Residential", "SF w/Det Ohana or Cottage"),
    ).toBe("Single Family");
    expect(normalizePropertyType("Residential", "Multi Family")).toBe(
      "Multi-Family",
    );
    expect(normalizePropertyType("Residential", "Farm")).toBe("Farm");
    expect(normalizePropertyType("Vacant Land", null)).toBe("Vacant Land");
    expect(normalizePropertyType("Vacant Land", "Unimproved Land")).toBe(
      "Vacant Land",
    );
    expect(normalizePropertyType("Commercial", "Warehouse")).toBe("Commercial");
    expect(normalizePropertyType("Commercial", "Condominium")).toBe(
      "Commercial",
    );
    // Unrecognized: passed through rather than guessed.
    expect(normalizePropertyType("Residential", "Houseboat")).toBe("Houseboat");
    expect(normalizePropertyType("Business Opportunity", null)).toBe(
      "Business Opportunity",
    );
    expect(normalizePropertyType(null, null)).toBeNull();
  });

  test("Land Tenure spellings", () => {
    for (const raw of ["FeeSimple", "Fee Simple", "fee simple"]) {
      expect(syn({ pairs: [["Land Tenure", raw]] }).fields).toMatchObject({
        tenure: "FS",
        land_tenure: "Fee Simple",
      });
    }
    expect(
      syn({ pairs: [["Description Land Tenure", "Leasehold"]] }).fields,
    ).toMatchObject({
      tenure: "LH",
      land_tenure: "Leasehold",
    });
    expect(
      syn({ pairs: [["Land Tenure", "Cooperative"]] }).fields,
    ).toMatchObject({
      tenure: null,
      land_tenure: "Cooperative",
    });
  });

  test("Interior / Exterior / Features are renamed for HBR only", () => {
    const quirks: Array<[string, string]> = [
      ["Interior", "Carpet, Vinyl"],
      ["Exterior", "Double Wall, Concrete"],
      ["Features", "Cleared, Level"],
    ];
    const hbr = syn({ mls: "202600001", photo: PHOTO.HBR, pairs: quirks });
    expect(hbr.fields).toMatchObject({
      floor_covering: "Carpet, Vinyl",
      construction: "Double Wall, Concrete",
      lot_description: "Cleared, Level",
    });
    expect(hbr.extra).not.toHaveProperty("Interior");

    for (const photo of [PHOTO.RAM, PHOTO.HIS]) {
      const other = syn({ photo, pairs: quirks });
      for (const column of [
        "floor_covering",
        "construction",
        "lot_description",
      ]) {
        expect(column in other.fields).toBe(false);
      }
      expect(other.extra).toMatchObject({
        Interior: "Carpet, Vinyl",
        Exterior: "Double Wall, Concrete",
        Features: "Cleared, Level",
      });
    }
  });

  test("a fallback key never overrides the primary; a differing value is kept in extra", () => {
    const r = syn({
      mls: "202600001",
      photo: PHOTO.HBR,
      pairs: [
        ["Exterior", "Stucco"],
        ["Construction", "Double Wall"],
        ["Features", "level"],
        ["Lot Description", "Level"],
      ],
    });
    expect(r.fields.construction).toBe("Double Wall");
    expect(r.extra.Exterior).toBe("Stucco");
    expect(r.fields.lot_description).toBe("Level");
    expect("Features" in r.extra).toBe(false); // same value, nothing to keep
  });

  test("Pool, else Has Pool", () => {
    expect(syn({ pairs: [["Has Pool", "Yes"]] }).fields.pool).toBe("Yes");
    const both = syn({
      pairs: [
        ["Has Pool", "Yes"],
        ["Pool", "In Ground"],
      ],
    });
    expect(both.fields.pool).toBe("In Ground");
    expect("Has Pool" in both.extra).toBe(false);
  });

  test("Frontage, else RAM Waterfront unless it is None", () => {
    expect(
      syn({ pairs: [["Waterfront", "None"]] }).fields.frontage,
    ).toBeUndefined();
    expect(syn({ pairs: [["Waterfront", "None"]] }).extra).not.toHaveProperty(
      "Waterfront",
    );
    expect(
      syn({ pairs: [["Waterfront", "Ocean Front"]] }).fields.frontage,
    ).toBe("Ocean Front");
    expect(
      syn({
        pairs: [
          ["Waterfront", "Ocean Front"],
          ["Frontage", "Ocean"],
        ],
      }).fields.frontage,
    ).toBe("Ocean");
  });

  test("a long value rendered as its own section takes the section header as its key", () => {
    const r = syn({
      sections:
        longValue(
          "Appliances",
          "Dishwasher, Disposal, Dryer, Microwave, Range",
        ) +
        longValue("View", "Coastline, Mountain(s), Ocean, Sunset") +
        longValue("Office", "Coldwell Banker Island Properties - Kauai") +
        longValue("Parking", "Detached, Electric Vehicle Charging Station(s)") +
        longValue(
          "Security Features",
          "Gated Community, Smoke Detector(s), Cameras",
        ) +
        section("Listing Details", ""),
    });
    expect(r.fields).toMatchObject({
      inclusions: "Dishwasher, Disposal, Dryer, Microwave, Range",
      view: "Coastline, Mountain(s), Ocean, Sunset",
      listing_office: "Coldwell Banker Island Properties - Kauai",
      parking_stalls_desc: "Detached, Electric Vehicle Charging Station(s)",
    });
    expect(r.extra["Security Features"]).toBe(
      "Gated Community, Smoke Detector(s), Cameras",
    );
  });

  test("unknown keys land in extra verbatim; blanks do not", () => {
    const r = syn({
      pairs: [
        ["Brand New Key", "  Some  Value &amp;amp; more "],
        ["Empty Key", ""],
        ["Dash Key", "--"],
        ["constructor", "not a rule"],
      ],
    });
    expect(r.extra["Brand New Key"]).toBe("Some  Value & more");
    expect(Object.entries(r.extra)).toContainEqual([
      "constructor",
      "not a rule",
    ]);
    expect("Empty Key" in r.extra).toBe(false);
    expect("Dash Key" in r.extra).toBe(false);
  });

  test("values: money, dates, status, linked city", () => {
    const r = syn({
      pairs: [
        ["Status", "Active Under Contract"], // second Status: first one wins
        ["Date Listed", "March 1st, 2026"],
        ["Monthly Maintenance Fees", "756.65"],
        ["HOA Fees", "79"],
        ["Assesed Value", "$1,671,900"],
        ["Square Footage", "2,919"],
        ["Year Built", "0"],
        ["City", '<a href="/big-island/puna">Puna</a>'],
      ],
    });
    expect(r.status).toBe("active");
    expect(r.statusRaw).toBe("Active");
    expect(r.fields).toMatchObject({
      list_price: 699000,
      list_date: "2026-03-01",
      maintenance_fees: 757,
      association_fees: 79,
      assd_val_total: 1671900,
      living_sf: 2919,
      year_built: null,
      city: "Puna",
    });
  });

  test("geo is trimmed of trailing zeros; zero / junk geo is ignored", () => {
    expect(
      syn({ geo: ["21.404387000000", "-158.000009000000"] }).extra,
    ).toMatchObject({
      Latitude: "21.404387",
      Longitude: "-158.000009",
    });
    expect(
      syn({ geo: ["21.000000000000", "-158.500000000000"] }).extra,
    ).toMatchObject({
      Latitude: "21",
      Longitude: "-158.5",
    });
    for (const geo of [
      ["0.000000000000", "0.000000000000"],
      ["", ""],
      ["abc", "-158.0"],
    ] as Array<[string, string]>) {
      const { extra } = syn({ geo });
      expect("Latitude" in extra).toBe(false);
      expect("Longitude" in extra).toBe(false);
    }
  });
});

// ── Unrecognizable pages ────────────────────────────────────────────────

describe("hres parseDetail — refusals", () => {
  test("a list page → MlsParseError", () => {
    expect(() => parseDetail(fixture("list-maui-p1.html"))).toThrow(
      MlsParseError,
    );
  });

  test("an arbitrary page → MlsParseError", () => {
    expect(() =>
      parseDetail("<html><body><h1>503 Service Unavailable</h1></body></html>"),
    ).toThrow(MlsParseError);
    expect(() => parseDetail("")).toThrow(MlsParseError);
  });

  test("no MLS # / malformed MLS # → MlsParseError", () => {
    const noNumber = page().replace(
      /<div class="keyval"><strong class="keyval__key">MLS&reg; #.*?<\/div>/,
      "",
    );
    expect(() => parseDetail(noNumber)).toThrow(/no 'MLS® #'/);
    expect(() =>
      parseDetail(page({ mls: "41A851", jsonMls: "41A851" })),
    ).toThrow(MlsParseError);
  });

  test("MLS # disagreeing with the data-listing JSON → MlsParseError", () => {
    expect(() =>
      parseDetail(page({ mls: "410851", jsonMls: "410827" })),
    ).toThrow(/disagrees/);
  });
});

// ── The mapping table itself ────────────────────────────────────────────

describe("HRES_KEY_MAP", () => {
  const kindOf = new Map<string, string>(
    MLS_COLUMNS.map((s) => [s.column, s.kind]),
  );

  test("every rule targets real columns, with the column's own kind", () => {
    for (const [key, rule] of Object.entries(HRES_KEY_MAP)) {
      if (rule.action === "column") {
        expect(kindOf.has(rule.column)).toBe(true);
        // lease_rent / lease_exp are text columns, so "$100" stays text.
        expect(`${key}:${rule.kind}`).toBe(`${key}:${kindOf.get(rule.column)}`);
      } else if (rule.action === "derived") {
        for (const column of rule.columns)
          expect(kindOf.has(column)).toBe(true);
      } else {
        expect(rule.reason.length).toBeGreaterThan(0);
      }
    }
  });

  test("the two dropped keys, and only those", () => {
    const dropped = Object.entries(HRES_KEY_MAP)
      .filter(([, rule]) => rule.action === "drop")
      .map(([key]) => key);
    expect(dropped.sort()).toEqual(["Days on Market", "Office Contact"]);
  });

  test("board-gated renames are exactly HBR's three", () => {
    const gated = Object.entries(HRES_KEY_MAP)
      .filter(
        ([, rule]) => rule.action === "column" && rule.boards !== undefined,
      )
      .map(([key, rule]) => [
        key,
        rule.action === "column" ? rule.boards : null,
      ]);
    expect(gated).toEqual([
      ["Interior", ["HBR"]],
      ["Exterior", ["HBR"]],
      ["Features", ["HBR"]],
    ]);
  });

  test("columns the doc says this site never fills have no rule", () => {
    const targeted = new Set<string>();
    for (const rule of Object.values(HRES_KEY_MAP)) {
      if (rule.action === "column") targeted.add(rule.column);
      if (rule.action === "derived")
        rule.columns.forEach((c) => targeted.add(c));
    }
    for (const column of [
      "sold_price",
      "date_sold",
      "remarks",
      "listing_agent",
      "lanai_sf",
      "other_sf",
      "year_remodeled",
      "assd_val_land",
      "assd_val_imprv",
      "tax_year",
      "monthly_taxes",
      "home_exempt",
      "furnished",
      "security",
      "disclosures",
      "possession",
      "terms_accept",
      "land_recorded",
      "easements",
      "set_backs",
      "open_house",
    ]) {
      expect(targeted.has(column)).toBe(false);
    }
  });
});
