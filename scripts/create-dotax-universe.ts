/**
 * Populates the DOTAX universe from the parsed DOTAX report files:
 *
 *   data-dir/dotax/dotax.csv              one column per series, monthly
 *   data-dir/dotax/dotax_series_info.csv  one row of metadata per column
 *
 * Creates or updates, in order: the universe row, geographies (copied from
 * UHERO, plus UNK for the GE liability reports' "Unknown district"
 * column), units, the DOTAX source, categories (root → report family →
 * one data list per table), measurements + data list membership, series
 * + measurement links, and loaders. Idempotent: everything is keyed on
 * (universe, name / prefix / meta), so re-running after editing the
 * config below updates rows in place. Loaders are created but NOT run.
 *
 * Naming:
 *  - Info rows marked "series id (load)" keep their udaman name
 *    (TGBCMNS@HAW.M). Their measurement prefix drops the NS suffix, as in
 *    UHERO (TGBCM), so they can be aliased into UHERO later.
 *  - Slugged rows (ge-base-subtotal1@hi.m) become GE_BASE_SUBTOTAL1@HI.M:
 *    series names can't contain "-". The CSV reader matches the
 *    hyphenated header to the underscore name.
 *
 * Units: dollar series are stored in thousands ($Thous, loader scale
 * 0.001), as the UHERO series they will replace are. Quantities (gallons,
 * barrels, MMBtu) are stored as reported.
 *
 * Frequencies: every monthly series also gets quarterly and annual sums in
 * the same measurement, named and loaded as UHERO's are:
 *
 *   TGBCMNS@HI.Q   "TGBCMNS@HI.M".ts.aggregate(:quarter, :sum)
 *   TGBCM@HI.A     "TGBCMNS@HI.M".ts.aggregate(:year, :sum)
 *
 * (annual names drop the NS suffix; slug names just change frequency:
 * GE_BASE_SUBTOTAL1@HI.Q / .A). Every DOTAX unit is a flow, so all sum.
 *
 * Series with fewer than MIN_OBSERVATIONS points are skipped (single-month
 * parse artifacts, e.g. a one-off misspelled fund label); measurements
 * left with no series are dropped from their lists.
 *
 * Loaders: this creates the original `.tsn.load_from("dotax/dotax.csv")`
 * file loaders; scripts/convert-dotax-loaders.ts then switches them to the
 * DOTAX downloaders' load methods (and disables these). Re-running this
 * script does not bring them back: it only creates loaders that are missing.
 *
 * Usage: bun run scripts/create-dotax-universe.ts [--dry-run] [--verbose] [--include-sparse]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import LoaderCollection from "@catalog/collections/loader-collection";
import MeasurementCollection from "@catalog/collections/measurement-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import Series from "@catalog/models/series";
import type { Universe } from "@catalog/types/shared";
import DataFileReader from "@catalog/utils/data-file-reader";

import { getDataDir } from "@/lib/data-dir";
import { insertAndGetId, rawQuery } from "@/lib/mysql/db";

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const INCLUDE_SPARSE = process.argv.includes("--include-sparse");

const DOTAX: Universe = "DOTAX";
/** Relative to DATA_DIR; also the path the loaders read. */
const DATA_FILE = "dotax/dotax.csv";
const INFO_FILE = "dotax/dotax_series_info.csv";
const MIN_OBSERVATIONS = 2;
const LOADER_PRIORITY = 100;

const SOURCE = {
  description: "State of Hawaii Dept. of Taxation",
  link: "https://tax.hawaii.gov/",
};
const REPORTS_LINK = "https://tax.hawaii.gov/stats/a5_3txcolrpt/";
const PORTAL_DETAIL =
  "Recent and preliminary months from the DOTAX Collections Portal export, which supersedes the monthly report files where both have values.";

// ─── Units ───────────────────────────────────────────────────────────

type UnitDef = {
  shortLabel: string;
  longLabel: string;
  scale: number;
  decimals: number;
};

/** Keyed by the info file's `unit` column. */
const UNITS: Record<string, UnitDef> = {
  Dollars: {
    shortLabel: "$Thous",
    longLabel: "Thousands of current dollars",
    scale: 0.001,
    decimals: 1,
  },
  Gallons: {
    shortLabel: "Gallons",
    longLabel: "Gallons",
    scale: 1,
    decimals: 0,
  },
  "Barrels (printed in the GALLONS column)": {
    shortLabel: "Barrels",
    longLabel: "Barrels (42 U.S. gallons)",
    scale: 1,
    decimals: 0,
  },
  "MMBtu (printed in the GALLONS column)": {
    shortLabel: "MMBtu",
    longLabel: "Millions of British thermal units",
    scale: 1,
    decimals: 0,
  },
};

// ─── Geographies ─────────────────────────────────────────────────────

type GeoDef = {
  handle: string;
  displayName: string;
  displayNameShort: string;
  fips: string | null;
  geotype: string | null;
  listOrder: number | null;
};

/** Copied from UHERO at run time; these are fallbacks if UHERO lacks a row. */
const UHERO_GEOS: GeoDef[] = [
  {
    handle: "HI",
    displayName: "State of Hawaii",
    displayNameShort: "State of Hawaii",
    fips: "15",
    geotype: null,
    listOrder: 1,
  },
  {
    handle: "HON",
    displayName: "City and County of Honolulu",
    displayNameShort: "Honolulu County",
    fips: "15003",
    geotype: null,
    listOrder: null,
  },
  {
    handle: "HAW",
    displayName: "Hawaii County",
    displayNameShort: "Hawaii County",
    fips: "15001",
    geotype: null,
    listOrder: null,
  },
  {
    handle: "MAU",
    displayName: "Maui County",
    displayNameShort: "Maui County",
    fips: "15009",
    geotype: null,
    listOrder: null,
  },
  {
    handle: "KAU",
    displayName: "Kauai County",
    displayNameShort: "Kauai County",
    fips: "15007",
    geotype: null,
    listOrder: null,
  },
];
/** DOTAX-only: GE liabilities DOTAX could not assign to a district. */
const UNK_GEO: GeoDef = {
  handle: "UNK",
  displayName: "Unknown District",
  displayNameShort: "Unknown District",
  fips: null,
  geotype: null,
  listOrder: null,
};

// ─── Category tree, data lists, measurement names ────────────────────
//
// Rows are [file prefix, indent, portal name]. The file prefix is the
// info file id before "@". A measurement may sit in several lists; give
// its portal name on the first row and omit it after. Order and indent
// follow the DOTAX report layout (totals first, components indented).

type Row = [prefix: string, indent: 0 | 1 | 2 | 3, portalName?: string];
type ListDef = { key: string; name: string; description?: string; rows: Row[] };
type SectionDef = { key: string; name: string; lists: ListDef[] };

const geActivities = (
  fam: string,
  label: string,
  indent: 0 | 1 | 2 | 3,
): Row[] =>
  (
    [
      ["retailing", "Retailing"],
      ["services", "Services"],
      ["contracting", "Contracting"],
      ["theater", "Theater, Amusement, Radio, etc."],
      ["commissions", "Commissions"],
      ["hotel-rentals", "Hotel Rentals"],
      ["other-rentals", "All Other Rentals"],
      ["interest-all-others", "Interest & All Others"],
      ["use-4", "Use (4%)"],
    ] as const
  ).map(([k, l]) => [`${fam}-${k}`, indent, `${label}: ${l}`]);

const geLowerRate = (
  fam: string,
  label: string,
  indent: 0 | 1 | 2 | 3,
): Row[] =>
  (
    [
      ["producing", "Producing"],
      ["manufacturing", "Manufacturing"],
      ["wholesaling", "Wholesaling"],
      ["services-intermediary", "Services (Intermediary)"],
      ["services-wholesale", "Services (Wholesale)"],
      ["insurance-solicitors", "Insurance Solicitors"],
      ["use-half", "Use (1/2%)"],
    ] as const
  ).map(([k, l]) => [`${fam}-${k}`, indent, `${label}: ${l}`]);

/** udaman-named GE activity rows: [base prefix, collections prefix, label]. */
const GE_4PCT: [string, string, string][] = [
  ["TGBRTNS", "TGRRTNS", "Retailing"],
  ["TGBSVNS", "TGRSVNS", "Services"],
  ["TGBCTNS", "TGRCTNS", "Contracting"],
  ["TGBTHNS", "TGRTHNS", "Theater, Amusement, Radio, etc."],
  ["TGBCMNS", "TGRCMNS", "Commissions"],
  ["TGBHTNS", "TGRHTNS", "Hotel Rentals"],
  ["TGBORNS", "TGRORNS", "All Other Rentals"],
  ["TGBITONS", "TGRITONS", "Interest & All Others"],
  ["TGBITNS", "TGRITNS", "Interest"],
  ["TGBOTNS", "TGROTNS", "All Others (4%)"],
  ["TGBU4NS", "TGRU4NS", "Use (4%)"],
];
const GE_LOWER: [string, string, string][] = [
  ["TGBPDNS", "TGRPDNS", "Producing"],
  ["TGBMNNS", "TGRMNNS", "Manufacturing"],
  ["TGBWTNS", "TGRWTNS", "Wholesaling"],
  ["TGBSINS", "TGRSINS", "Services (Intermediary)"],
  ["TGBSWNS", "TGRSWNS", "Services (Wholesale)"],
  ["TGBISNS", "TGRISNS", "Insurance Solicitors"],
  ["TGBU5NS", "TGRU5NS", "Use (1/2%)"],
  ["TGBSUNS", "TGRSUNS", "Sugar Processing"],
  ["TGBPINS", "TGRPINS", "Pineapple Canning"],
];
/** Interest and All Others (4%) were printed separately until 2016-17 and sum to Interest & All Others. */
const geIndent = (label: string, base: 2 | 3): 0 | 1 | 2 | 3 =>
  label === "Interest" || label === "All Others (4%)" ? 3 : base;

const fuelTypes = (fam: string, label: string, indent: 0 | 1 | 2 | 3): Row[] =>
  (
    [
      ["gasoline", "Gasoline"],
      ["diesel-highway", "Diesel Oil (Highway)"],
      ["diesel-off-highway", "Diesel Oil (Off-Highway)"],
      ["lpg-highway", "Liquefied Petroleum Gas (Highway)"],
      ["lpg-off-highway", "Liquefied Petroleum Gas (Off-Highway)"],
      ["aviation", "Aviation Fuel"],
      ["small-boat-gasoline", "Small Boats (Gasoline)"],
      ["small-boat-diesel", "Small Boats (Diesel Oil)"],
      ["other-fuel", "Other Fuel"],
    ] as const
  ).map(([k, l]) => [`${fam}-${k}`, indent, `${label}: ${l}`]);

const ertRows = (fam: string, label: string): Row[] => [
  [`${fam}-subtotal2`, 1, `${label}: Environmental Response Tax Subtotal`],
  [
    `${fam}-ert-petroleum`,
    2,
    `${label}: Environmental Response Tax, Petroleum Products`,
  ],
  [
    `${fam}-ert-fossil`,
    2,
    `${label}: Environmental Response Tax, Fossil Fuels`,
  ],
];

const tobaccoFunds = (fam: string, period: string): Row[] =>
  (
    [
      ["cancer-research", "Hawaii Cancer Research Fund"],
      ["cigarette-stamp-admin", "Cigarette Stamp Administrative Fund"],
      ["cigarette-stamp-enforcement", "Cigarette Stamp Enforcement Fund"],
      ["community-health", "Community Health Centers Fund"],
      ["emergency-medical", "Emergency Medical Service Fund"],
      ["trauma", "Trauma System Fund"],
      ["tobacco-enforcement", "Tobacco Enforcement Fund"],
    ] as const
  )
    .filter(([k]) => fam === "tob-tobacco-fund" || k !== "tobacco-enforcement")
    .map(([k, l]) => [
      `${fam}-${k}`,
      0,
      `Tobacco Tax Allocation: ${l} (${period})`,
    ]);

const SECTIONS: SectionDef[] = [
  {
    key: "COLLECTIONS",
    name: "Tax Collections & Distribution",
    lists: [
      {
        key: "COLLECTIONS",
        name: "Tax Collections by Source",
        rows: [
          ["TRNS", 0, "Total Tax Collections"],
          ["TRGTNS", 1, "General Excise & Use Tax Collections"],
          [
            "TRTTNS",
            1,
            "Transient Accommodations & Timeshare Occupancy Tax Collections",
          ],
          ["TRTFNS", 1, "Transient Accommodations & Timeshare Occupancy Fees"],
          ["TRINWHNS", 1, "Individual Income Tax: Withholding on Wages"],
          [
            "TRINESNS",
            1,
            "Individual Income Tax: Declarations of Estimated Tax",
          ],
          ["TRINPRNS", 1, "Individual Income Tax: Payments with Returns"],
          ["TRINRFNS", 1, "Individual Income Tax: Refunds"],
          [
            "TRCOESNS",
            1,
            "Corporate Income Tax: Declarations of Estimated Tax",
          ],
          ["TRCOPRNS", 1, "Corporate Income Tax: Payments with Returns"],
          ["TRCORFNS", 1, "Corporate Income Tax: Refunds"],
          ["TRFINS", 1, "Banks & Financial Corporations Tax Collections"],
          ["TRCVNS", 1, "Conveyance Tax Collections"],
          ["TREMNS", 1, "Employment Security Contributions"],
          ["collec-collections-fuel", 1, "Fuel Tax Collections"],
          [
            "collec-collections-environmental",
            1,
            "Environmental Response Tax Collections",
          ],
          [
            "collec-collections-fuel-environmental",
            1,
            "Fuel & Environmental Response Tax Collections (Jan-Feb 2020)",
          ],
          ["TRGLNS", 1, "General Excise Licenses & Fees"],
          ["TRIHNS", 1, "Inheritance & Estate Tax Collections"],
          ["TRISNS", 1, "Insurance Premiums Tax Collections"],
          ["collec-collections-insurance-fees", 1, "Insurance Fees"],
          ["TRLINS", 1, "Liquor Tax & Permit Collections"],
          ["TRMTNS", 1, "Motor Vehicle & Rental Vehicle Taxes & Fees"],
          ["TRMTVRNS", 2, "Motor Vehicle Taxes & Fees"],
          ["TRMTRVNS", 2, "Rental Vehicle Taxes & Fees"],
          ["TRPSNS", 1, "Public Service Company Tax Collections"],
          ["TRTBNS", 1, "Cigarette & Tobacco Tax Collections"],
          ["TRHSNS", 1, "County Surcharge on GE Tax"],
          ["TROTNS", 1, "All Other Tax Collections"],
        ],
      },
      {
        key: "DISTRIBUTION",
        name: "Distribution of Tax Collections",
        rows: [
          [
            "collec-grand-total-grand-total",
            0,
            "Total Distribution of Tax Collections",
          ],
          [
            "collec-distribution-subtotal",
            1,
            "Distribution to State Funds, Subtotal",
          ],
          ["TDGFNS", 2, "State General Fund"],
          [
            "collec-distribution-agricultural-development-and-food-security-fund",
            2,
            "Agricultural Development & Food Security Fund",
          ],
          ["TDAPNS", 2, "State Airport Fund"],
          ["TDBONS", 2, "Boating Special Fund"],
          [
            "collec-distribution-cancer-research-fund",
            2,
            "Cancer Research Fund",
          ],
          ["TDCANS", 2, "Cigarette Stamp Administrative Fund"],
          ["TDCENS", 2, "Cigarette Stamp Enforcement Fund"],
          [
            "collec-distribution-community-health-centers-fund",
            2,
            "Community Health Centers Fund",
          ],
          [
            "collec-distribution-compliance-resolution-fund",
            2,
            "Compliance Resolution Fund",
          ],
          ["TDCVNS", 2, "Convention Center Enterprise Fund"],
          [
            "collec-distribution-domestic-violence-fund",
            2,
            "Domestic Violence & Child Abuse and Neglect Funds",
          ],
          [
            "collec-distribution-election-campaign-fund",
            2,
            "Election Campaign Fund",
          ],
          [
            "collec-distribution-electric-vehicle-charging-system-subaccount",
            2,
            "Electric Vehicle Charging System Subaccount",
          ],
          [
            "collec-distribution-emergency-medical-service-fund",
            2,
            "Emergency Medical Service Fund",
          ],
          ["TDEMNS", 2, "Employment Security Fund"],
          [
            "collec-distribution-energy-security-fund",
            2,
            "Energy Security Fund",
          ],
          [
            "collec-distribution-energy-systems-development-fund",
            2,
            "Energy Systems Development Fund",
          ],
          ["TDEVNS", 2, "Environmental Fund"],
          ["TDHWNS", 2, "State Highway Fund"],
          [
            "collec-distribution-hurricane-relief-fund",
            2,
            "Hurricane Relief Fund",
          ],
          [
            "collec-distribution-hydrogen-fueling-system-subaccount",
            2,
            "Hydrogen Fueling System Subaccount",
          ],
          [
            "collec-distribution-land-and-development-fund",
            2,
            "Land and Development Fund",
          ],
          [
            "collec-distribution-land-conservation-fund",
            2,
            "Land Conservation Fund",
          ],
          ["collec-distribution-mass-transit-fund", 2, "Mass Transit Fund"],
          ["TDNANS", 2, "Natural Area Reserve Fund"],
          [
            "collec-distribution-public-libraries-fund",
            2,
            "Public Libraries Fund",
          ],
          ["TDRHNS", 2, "Rental Housing Fund"],
          [
            "collec-distribution-school-repairs-fund",
            2,
            "School Minor Repairs & Maintenance Fund",
          ],
          [
            "collec-distribution-tax-administration-fund",
            2,
            "Tax Administration Fund",
          ],
          ["TDTTNS", 2, "TAT Trust Fund"],
          [
            "collec-distribution-tourism-emergency-special-fund",
            2,
            "Tourism Emergency Special Fund",
          ],
          ["TDTSNS", 2, "Tourism Special Fund"],
          ["collec-distribution-trauma-system-fund", 2, "Trauma System Fund"],
          [
            "collec-distribution-turtle-bay-conservation-easement-fund",
            2,
            "Turtle Bay Conservation Easement Fund",
          ],
          ["TRHSNS", 1],
          ["TDCTNS", 1, "Other County Revenue, Total"],
          ["TDCTFUNS", 2, "County Fuel Tax Revenue"],
          ["TDCTTTNS", 2, "County Share of Transient Accommodations Tax"],
        ],
      },
      {
        key: "COUNTY_SURCHARGE",
        name: "County Surcharge on GE Tax",
        description:
          "State of Hawaii is statewide county surcharge collections; each county is the surcharge distributed to that county.",
        rows: [
          ["TRHSNS", 0],
          ["TRHASNS", 1, "County Surcharge Distributed to Hawaii County"],
          ["TRKSNS", 1, "County Surcharge Distributed to Kauai County"],
          ["TRMSNS", 1, "County Surcharge Distributed to Maui County"],
          [
            "collec-county-surcharge-honolulu-surcharge",
            1,
            "Honolulu County Surcharge Distribution (2007-2017)",
          ],
          [
            "collec-county-surcharge-county-surcharges",
            1,
            "County Surcharge Distribution, All Counties (Jan-Jun 2019)",
          ],
        ],
      },
    ],
  },
  {
    key: "GE",
    name: "General Excise & Use Tax",
    lists: [
      {
        key: "GE_BASE",
        name: "GE Tax Base by Business Activity",
        rows: [
          ["TGBNS", 0, "Total GE & Use Tax Base"],
          ["ge-base-subtotal1", 1, "GE Tax Base: 4% Activities Subtotal"],
          ...GE_4PCT.map(([b, , l]): Row => [
            b,
            geIndent(l, 2),
            `GE Tax Base: ${l}`,
          ]),
          [
            "ge-base-subtotal2",
            1,
            "GE Tax Base: Lower-Rate Activities Subtotal",
          ],
          ...GE_LOWER.map(([b, , l]): Row => [b, 2, `GE Tax Base: ${l}`]),
        ],
      },
      {
        key: "GE_COLLECTIONS",
        name: "GE Tax Collections by Business Activity",
        rows: [
          ["TGRNS", 0, "Total GE & Use Tax Collections"],
          ["TGRALNS", 1, "GE Tax Collections: Allocated"],
          [
            "ge-collections-subtotal1",
            2,
            "GE Tax Collections: 4% Activities Subtotal",
          ],
          ...GE_4PCT.map(([, c, l]): Row => [c, 3, `GE Tax Collections: ${l}`]),
          [
            "ge-collections-subtotal2",
            2,
            "GE Tax Collections: Lower-Rate Activities Subtotal",
          ],
          ...GE_LOWER.map(([, c, l]): Row => [
            c,
            3,
            `GE Tax Collections: ${l}`,
          ]),
          ["TGRUANS", 1, "GE Tax Collections: Unallocated"],
        ],
      },
      {
        key: "GE_LIAB_BASE",
        name: "GE Tax Base by Filing Period",
        description:
          "Tax base for GE and use tax liabilities incurred in the filing period (by period of activity rather than month collected).",
        rows: [
          [
            "liab-ge-base-grand-total",
            0,
            "Total GE Tax Base, by Filing Period",
          ],
          [
            "liab-ge-base-subtotal1",
            1,
            "GE Tax Base by Filing Period: 4% Activities Subtotal",
          ],
          ...geActivities("liab-ge-base", "GE Tax Base by Filing Period", 2),
          [
            "liab-ge-base-subtotal2",
            1,
            "GE Tax Base by Filing Period: Lower-Rate Activities Subtotal",
          ],
          ...geLowerRate("liab-ge-base", "GE Tax Base by Filing Period", 2),
        ],
      },
      {
        key: "GE_LIAB",
        name: "GE Tax Liabilities by Filing Period",
        description:
          "GE and use tax liabilities incurred in the filing period (by period of activity rather than month collected).",
        rows: [
          ["liab-ge-liability-grand-total", 0, "Total GE Tax Liabilities"],
          [
            "liab-ge-liability-subtotal1",
            1,
            "GE Tax Liabilities: 4% Activities Subtotal",
          ],
          ...geActivities("liab-ge-liability", "GE Tax Liabilities", 2),
          [
            "liab-ge-liability-subtotal2",
            1,
            "GE Tax Liabilities: Lower-Rate Activities Subtotal",
          ],
          ...geLowerRate("liab-ge-liability", "GE Tax Liabilities", 2),
          [
            "liab-ge-liability-unallocated",
            1,
            "GE Tax Liabilities: Unallocated",
          ],
        ],
      },
    ],
  },
  {
    key: "TAT",
    name: "Transient Accommodations Tax",
    lists: [
      {
        key: "TAT_LIAB",
        name: "TAT Base & Liabilities by Filing Period",
        rows: [
          ["liab-tat-base-total", 0, "Total TAT Base, by Filing Period"],
          [
            "liab-tat-base-transient-accommodations",
            1,
            "TAT Base by Filing Period: Transient Accommodations",
          ],
          [
            "liab-tat-base-timeshare",
            1,
            "TAT Base by Filing Period: Timeshare Occupancy",
          ],
          ["liab-tat-liability-total", 0, "Total TAT Liabilities"],
          [
            "liab-tat-liability-transient-accommodations",
            1,
            "TAT Liabilities: Transient Accommodations",
          ],
          [
            "liab-tat-liability-timeshare",
            1,
            "TAT Liabilities: Timeshare Occupancy",
          ],
        ],
      },
    ],
  },
  {
    key: "FUEL",
    name: "Liquid Fuel Tax",
    lists: [
      {
        key: "FUEL_QUANTITY",
        name: "Liquid Fuel Taxed",
        rows: [
          [
            "fuels-base-gallons-subtotal1",
            0,
            "Liquid Fuel Taxed: Total Gallons",
          ],
          ...fuelTypes("fuels-base-gallons", "Liquid Fuel Taxed", 1),
          [
            "fuels-base-gallons-ert-petroleum",
            0,
            "Petroleum Products Subject to Environmental Response Tax",
          ],
          [
            "fuels-base-gallons-ert-fossil",
            0,
            "Fossil Fuels Subject to Environmental Response Tax",
          ],
        ],
      },
      {
        key: "FUEL_TOTAL",
        name: "Liquid Fuel Tax Collections, State & County",
        rows: [
          ["TRFUNS", 0, "Total Liquid Fuel Tax Collections"],
          [
            "fuels-base-total-subtotal1",
            1,
            "Fuel Tax Collections: Fuel Types Subtotal",
          ],
          ...fuelTypes("fuels-base-total", "Fuel Tax Collections", 2),
          ...ertRows("fuels-base-total", "Fuel Tax Collections"),
        ],
      },
      {
        key: "FUEL_STATE",
        name: "Liquid Fuel Tax Collections, State Tax",
        rows: [
          ["fuels-base-state-total", 0, "Total State Fuel Tax Collections"],
          [
            "fuels-base-state-subtotal1",
            1,
            "State Fuel Tax: Fuel Types Subtotal",
          ],
          ...fuelTypes("fuels-base-state", "State Fuel Tax", 2),
          ...ertRows("fuels-base-state", "State Fuel Tax"),
        ],
      },
      {
        key: "FUEL_COUNTY",
        name: "Liquid Fuel Tax Collections, County Tax",
        rows: [
          ["fuels-base-county-total", 0, "Total County Fuel Tax Collections"],
          [
            "fuels-base-county-subtotal1",
            1,
            "County Fuel Tax: Fuel Types Subtotal",
          ],
          ...fuelTypes("fuels-base-county", "County Fuel Tax", 2),
        ],
      },
      {
        key: "FUEL_ALLOC",
        name: "Liquid Fuel Tax Allocation by Fund",
        description: "AMOUNT column of the fuel tax allocation table.",
        rows: [
          [
            "fuels-alloc-amount-highway-fund",
            0,
            "Fuel Tax Allocation: State Highway Special Fund",
          ],
          [
            "fuels-alloc-amount-airport-fund",
            0,
            "Fuel Tax Allocation: State Airports Special Fund",
          ],
          [
            "fuels-alloc-amount-boating-fund",
            0,
            "Fuel Tax Allocation: State Boating Special Fund",
          ],
          [
            "fuels-alloc-amount-general-fund",
            0,
            "Fuel Tax Allocation: General Fund",
          ],
          [
            "fuels-alloc-amount-environmental-fund",
            0,
            "Fuel Tax Allocation: Environmental Response Revolving Fund",
          ],
          [
            "fuels-alloc-amount-energy-security-fund",
            0,
            "Fuel Tax Allocation: Energy Security Special Fund",
          ],
          [
            "fuels-alloc-amount-energy-systems-fund",
            0,
            "Fuel Tax Allocation: Energy Systems Development Special Fund",
          ],
          [
            "fuels-alloc-amount-agricultural-fund",
            0,
            "Fuel Tax Allocation: Agricultural Development & Food Security Fund",
          ],
          [
            "fuels-alloc-amount-ev-charging-fund",
            0,
            "Fuel Tax Allocation: Electric Vehicle Charging System Subaccount",
          ],
          [
            "fuels-alloc-amount-hydrogen-fund",
            0,
            "Fuel Tax Allocation: Hydrogen Fueling System Subaccount",
          ],
          ["TDCTFUNS", 0],
          [
            "fuels-alloc-amount-county-fuel-tax-maui",
            1,
            "Fuel Tax Allocation: County Fuel Tax, Island of Maui",
          ],
          [
            "fuels-alloc-amount-county-fuel-tax-molokai",
            1,
            "Fuel Tax Allocation: County Fuel Tax, Island of Molokai",
          ],
          [
            "fuels-alloc-amount-county-fuel-tax-lanai",
            1,
            "Fuel Tax Allocation: County Fuel Tax, Island of Lanai",
          ],
          [
            "fuels-alloc-amount-county-fuel-tax",
            0,
            "Fuel Tax Allocation: County Fuel Tax",
          ],
          [
            "fuels-alloc-amount-subtotal1",
            0,
            "Fuel Tax Allocation: Fuel Types Subtotal",
          ],
        ],
      },
      {
        key: "FUEL_ALLOC_TOTAL",
        name: "Liquid Fuel Tax Allocation, Total Tax",
        description: "TOTAL TAX column of the fuel tax allocation table.",
        rows: [
          ["fuels-alloc-total-total", 0, "Total Liquid Fuel Tax Allocated"],
          [
            "fuels-alloc-total-subtotal1",
            1,
            "Fuel Tax Allocation, Total Tax: Fuel Types Subtotal",
          ],
          ["TDCTFUNS", 1],
          [
            "fuels-alloc-total-county-fuel-tax",
            1,
            "Fuel Tax Allocation, Total Tax: County Fuel Tax",
          ],
          [
            "fuels-alloc-total-boating-fund",
            1,
            "Fuel Tax Allocation, Total Tax: State Boating Special Fund",
          ],
          [
            "fuels-alloc-total-general-fund",
            1,
            "Fuel Tax Allocation, Total Tax: General Fund",
          ],
          [
            "fuels-alloc-total-environmental-fund",
            1,
            "Fuel Tax Allocation, Total Tax: Environmental Tax Fund",
          ],
        ],
      },
    ],
  },
  {
    key: "LIQUOR",
    name: "Liquor Tax",
    lists: [
      {
        key: "LIQUOR",
        name: "Liquor Tax Collections",
        description: "DOTAX changed the liquor report format in July 2019.",
        rows: [
          ["TRLINS", 0],
          [
            "liq-liquor-total",
            1,
            "Liquor Tax: Total Collections (from Jul 2019)",
          ],
          ["liq-liquor-wholesale", 2, "Liquor Tax: Wholesale (from Jul 2019)"],
          ["liq-liquor-permits", 2, "Liquor Tax: Permit Fees (from Jul 2019)"],
          [
            "liq-liquor-penalties",
            2,
            "Liquor Tax: Penalties & Interest (from Jul 2019)",
          ],
          [
            "liqtob-liquor-total",
            1,
            "Liquor Tax: Total Collections (through Jun 2019)",
          ],
          [
            "liqtob-liquor-wholesale",
            2,
            "Liquor Tax: Wholesale (through Jun 2019)",
          ],
          [
            "liqtob-liquor-permits",
            2,
            "Liquor Tax: Permit Fees (through Jun 2019)",
          ],
          [
            "liqtob-liquor-penalties",
            2,
            "Liquor Tax: Penalties & Interest (through Jun 2019)",
          ],
        ],
      },
    ],
  },
  {
    key: "TOBACCO",
    name: "Cigarette & Tobacco Tax",
    lists: [
      {
        key: "TOBACCO",
        name: "Cigarette & Tobacco Tax Collections",
        description: "DOTAX changed the tobacco report format in July 2019.",
        rows: [
          ["TRTBNS", 0],
          [
            "tob-tobacco-total",
            1,
            "Tobacco Tax: Total Net Collections (from Jul 2019)",
          ],
          [
            "tob-tobacco-cigarettes",
            2,
            "Tobacco Tax: Cigarettes (from Jul 2019)",
          ],
          [
            "tob-tobacco-little-cigars",
            2,
            "Tobacco Tax: Little Cigars (from Jul 2019)",
          ],
          ["tob-tobacco-cigars", 2, "Tobacco Tax: Cigars (from Jul 2019)"],
          [
            "tob-tobacco-e-liquids",
            2,
            "Tobacco Tax: E-Liquids (from Jul 2019)",
          ],
          [
            "tob-tobacco-other-tobacco",
            2,
            "Tobacco Tax: All Other Tobacco Products (from Jul 2019)",
          ],
          [
            "tob-tobacco-licenses",
            2,
            "Tobacco Tax: License Fees (from Jul 2019)",
          ],
          [
            "tob-tobacco-retail-permits",
            2,
            "Tobacco Tax: Retail Permits (from Jul 2019)",
          ],
          [
            "tob-tobacco-unallocated",
            2,
            "Tobacco Tax: Unallocated Net Collections (from Jul 2019)",
          ],
          [
            "liqtob-tobacco-total",
            1,
            "Tobacco Tax: Total Collections (through Jun 2019)",
          ],
          [
            "liqtob-tobacco-cigarettes",
            2,
            "Tobacco Tax: Cigarettes (through Jun 2019)",
          ],
          [
            "liqtob-tobacco-little-cigars",
            2,
            "Tobacco Tax: Little Cigars (through Jun 2019)",
          ],
          [
            "liqtob-tobacco-cigars",
            2,
            "Tobacco Tax: Cigars (through Jun 2019)",
          ],
          [
            "liqtob-tobacco-other-tobacco",
            2,
            "Tobacco Tax: All Other Tobacco Products (through Jun 2019)",
          ],
          [
            "liqtob-tobacco-licenses",
            2,
            "Tobacco Tax: License Fees (through Jun 2019)",
          ],
          [
            "liqtob-tobacco-retail-permits",
            2,
            "Tobacco Tax: Retail Permits (through Jun 2019)",
          ],
          [
            "liqtob-tobacco-penalties",
            2,
            "Tobacco Tax: Penalties & Interest (through Jun 2019)",
          ],
        ],
      },
      {
        key: "TOBACCO_FUNDS",
        name: "Cigarette & Tobacco Tax Special Fund Allocations",
        rows: [
          ...tobaccoFunds("tob-tobacco-fund", "from Jul 2019"),
          ...tobaccoFunds("liqtob-tobacco-fund", "through Jun 2019"),
        ],
      },
    ],
  },
];

/**
 * Measurements created but kept off the data lists: each carries the same
 * values as a listed measurement under an older udaman name (see the info
 * file notes), so listing both would show duplicate rows.
 */
const UNLISTED: Record<string, string> = {
  TRCTFUNS: "County Fuel Tax Revenue",
  TRCTTTNS: "County Share of Transient Accommodations Tax",
  TGBAONS: "GE Tax Base: All Others (4%)",
  TGRAONS: "GE Tax Collections: All Others (4%)",
  "collec-distribution-domestic-viloence-child-abuse-neglect-funds":
    "Domestic Violence & Child Abuse Neglect Funds (Jan 2006 label)",
};

/** Loaders beyond the file load, by series name (see the info file notes). */
const EXTRA_LOADERS: Record<string, { code: string; priority: number }[]> = {
  // Combined line through 2020-02; DOTAX splits it from 2020-03.
  "TRMTNS@HI.M": [
    { code: `"TRMTVRNS@HI.M".ts + "TRMTRVNS@HI.M".ts`, priority: 90 },
  ],
};

/**
 * Reload order. batchReload runs the deepest series first, but
 * assignDependencyDepth only covers UHERO, so DOTAX's depths are set here:
 * the aggregates (0) after the monthly series (1), after the monthly
 * series other loaders read (2).
 */
const LOADER_INPUTS = new Set(
  Object.values(EXTRA_LOADERS).flatMap((ls) =>
    ls.flatMap((l) => [...l.code.matchAll(/"([^"]+)"\.ts/g)].map((m) => m[1])),
  ),
);

// ─── Info file ───────────────────────────────────────────────────────

type InfoRow = Record<string, string>;

/** RFC 4180 CSV → rows of fields (quoted fields may hold commas, "" and newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

function readInfo(): InfoRow[] {
  const text = readFileSync(join(getDataDir(), INFO_FILE), "utf-8").replace(
    /^\uFEFF/,
    "",
  );
  const [header, ...rows] = parseCsv(text);
  return rows.map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])),
  );
}

// ─── Plan ────────────────────────────────────────────────────────────

type SeriesSpec = {
  fileId: string;
  name: string;
  geo: string;
  filePrefix: string;
  observations: number;
  info: InfoRow;
};

type MeasurementSpec = {
  filePrefix: string;
  prefix: string;
  portalName: string;
  unit: UnitDef;
  notes: string | null;
  sourceLink: string | null;
  series: SeriesSpec[];
};

/** Fit a value to a VARCHAR(n) column ("" → null). */
function clip(v: string | null | undefined, n: number): string | null {
  if (!v) return null;
  return v.length <= n ? v : v.slice(0, n - 3) + "...";
}

const isUdamanNamed = (info: InfoRow) => info.mnemonic.startsWith("series id");

type AggregateSpec = {
  name: string;
  frequency: "quarter" | "year";
  code: string;
};

const AGGREGATES = [
  { frequency: "quarter", suffix: "Q", period: ":quarter" },
  { frequency: "year", suffix: "A", period: ":year" },
] as const;

/** The quarterly and annual sums of a monthly series. */
function aggregates(s: SeriesSpec): AggregateSpec[] {
  const { prefix } = Series.parseName(s.name);
  return AGGREGATES.map((a) => ({
    name: `${a.suffix === "A" ? measurementPrefix(s.name, isUdamanNamed(s.info)) : prefix}@${s.geo}.${a.suffix}`,
    frequency: a.frequency,
    code: `"${s.name}".ts.aggregate(${a.period}, :sum)`,
  }));
}

/** Series names can't hold "-"; udaman names upper-case everything. */
function seriesName(fileId: string): string {
  return fileId.toUpperCase().replace(/-/g, "_");
}

/** UHERO measurement prefixes drop the NS suffix (TGBCMNS@HI.M → TGBCM). */
function measurementPrefix(name: string, udamanNamed: boolean): string {
  const prefix = name.split("@")[0];
  return udamanNamed ? prefix.replace(/NS$/, "") : prefix;
}

/** "1/ Other fuel includes ..." → "Other fuel includes ..." */
const cleanFootnote = (f: string) => f.replace(/^\s*\d+\/\s*/, "").trim();

/** The DOTAX monthly reports page covers the collections, GE, fuel, liquor and tobacco reports. */
const reportLink = (info: InfoRow) =>
  info.report_type.startsWith("liab_") ? null : REPORTS_LINK;

function describeSeries(info: InfoRow): string | null {
  const foot = cleanFootnote(info.footnote);
  return clip(foot ? `${info.name}. ${foot}` : info.name, 500);
}

function investigationNotes(s: SeriesSpec): string | null {
  const i = s.info;
  const parts = [
    s.fileId !== s.name ? `File column: ${s.fileId}.` : "",
    i.note ? `Note: ${i.note}.` : "",
    `Source: ${i.source}.`,
    `Table: ${i.report_title} > ${i.table} > ${i.column} > row "${i.row_label_variants}".`,
  ];
  return clip(parts.filter(Boolean).join(" "), 500);
}

function plan(info: InfoRow[], reader: DataFileReader) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Portal names and list membership from the config.
  const portalNames = new Map<string, string>();
  for (const sec of SECTIONS)
    for (const list of sec.lists)
      for (const [p, , n] of list.rows) {
        const prev = portalNames.get(p);
        if (n && prev && prev !== n)
          errors.push(`${p}: portal name "${n}" conflicts with "${prev}"`);
        if (n && !prev) portalNames.set(p, n);
      }
  for (const [p, n] of Object.entries(UNLISTED)) {
    if (portalNames.has(p)) errors.push(`${p} is both listed and UNLISTED`);
    portalNames.set(p, n);
  }

  // Series, grouped by file prefix.
  const groups = new Map<string, SeriesSpec[]>();
  const skipped: SeriesSpec[] = [];
  const names = new Set<string>();
  for (const row of info) {
    const name = seriesName(row.id);
    if (!Series.isValidName(name)) errors.push(`Invalid series name: ${name}`);
    if (names.has(name)) errors.push(`Duplicate series name: ${name}`);
    names.add(name);
    if (!/\.M$/.test(name)) errors.push(`${name}: expected monthly`);
    if (!UNITS[row.unit]) errors.push(`${name}: unknown unit "${row.unit}"`);

    let observations = 0;
    try {
      observations = reader.series(name).size;
    } catch {
      errors.push(`${name}: no column in ${DATA_FILE}`);
    }
    const spec: SeriesSpec = {
      fileId: row.id,
      name,
      geo: Series.parseName(name).geo,
      filePrefix: row.id.split("@")[0],
      observations,
      info: row,
    };
    if (!INCLUDE_SPARSE && observations < MIN_OBSERVATIONS) {
      skipped.push(spec);
      continue;
    }
    for (const a of aggregates(spec)) {
      if (!Series.isValidName(a.name))
        errors.push(`Invalid series name: ${a.name}`);
      if (names.has(a.name))
        errors.push(`Duplicate series name: ${a.name} (from ${name})`);
      names.add(a.name);
    }
    const g = groups.get(spec.filePrefix) ?? [];
    g.push(spec);
    groups.set(spec.filePrefix, g);
  }

  const known = new Set(info.map((r) => r.id.split("@")[0]));
  for (const p of portalNames.keys())
    if (!known.has(p))
      errors.push(`Config names ${p}, which is not in ${INFO_FILE}`);

  // Measurements.
  const measurements = new Map<string, MeasurementSpec>();
  const prefixes = new Map<string, string>();
  for (const [filePrefix, series] of groups) {
    const portalName = portalNames.get(filePrefix);
    if (!portalName) {
      errors.push(
        `No portal name / list for ${filePrefix} (add it to SECTIONS or UNLISTED)`,
      );
      continue;
    }
    const units = new Set(series.map((s) => s.info.unit));
    if (units.size > 1)
      errors.push(`${filePrefix}: mixed units ${[...units].join(" / ")}`);
    const prefix = measurementPrefix(
      series[0].name,
      isUdamanNamed(series[0].info),
    );
    if (prefixes.has(prefix))
      errors.push(
        `Measurement prefix ${prefix} used by ${filePrefix} and ${prefixes.get(prefix)}`,
      );
    prefixes.set(prefix, filePrefix);
    const footnotes = [
      ...new Set(
        series.map((s) => cleanFootnote(s.info.footnote)).filter(Boolean),
      ),
    ];
    const hi = series.find((s) => s.geo === "HI") ?? series[0];
    measurements.set(filePrefix, {
      filePrefix,
      prefix,
      portalName,
      unit: UNITS[[...units][0]],
      notes: clip(footnotes.join(" "), 500),
      sourceLink: reportLink(hi.info),
      series,
    });
  }

  // Lists keep only measurements that still have series.
  const lists = SECTIONS.map((sec) => ({
    ...sec,
    lists: sec.lists.map((list) => {
      const rows = list.rows.filter(([p]) => measurements.has(p));
      const seen = new Map<string, string>();
      for (const [p] of rows) {
        const n = measurements.get(p)!.portalName;
        if (seen.has(n))
          errors.push(`${list.name}: "${n}" used by ${p} and ${seen.get(n)}`);
        seen.set(n, p);
      }
      if (rows.length < list.rows.length)
        warnings.push(
          `${list.name}: dropped ${list.rows
            .filter(([p]) => !measurements.has(p))
            .map(([p]) => p)
            .join(", ")} (no series left)`,
        );
      return { ...list, rows };
    }),
  }));

  // udaman's text columns are latin1; the config should stay ASCII.
  for (const m of measurements.values())
    if (/[^\x20-\x7e]/.test(m.portalName))
      errors.push(`Non-ASCII portal name: ${m.portalName}`);

  return { measurements, lists, skipped, errors, warnings };
}

// ─── Database helpers ────────────────────────────────────────────────

type Params = (string | number | null)[];

async function findId(sql: string, params: Params): Promise<number | null> {
  const rows = await rawQuery<{ id: number }>(
    sql,
    params as (string | number)[],
  );
  return rows[0]?.id ?? null;
}

async function upsertId(
  findSql: string,
  findParams: Params,
  insertSql: string,
  insertParams: Params,
): Promise<number> {
  return (
    (await findId(findSql, findParams)) ??
    (await insertAndGetId(insertSql, insertParams))
  );
}

async function ensureGeographies(
  handles: Set<string>,
): Promise<Map<string, number>> {
  const uhero = await rawQuery<{
    handle: string;
    display_name: string;
    display_name_short: string;
    fips: string | null;
    geotype: string | null;
    list_order: number | null;
  }>(
    `SELECT handle, display_name, display_name_short, fips, geotype, list_order
     FROM geographies WHERE universe = 'UHERO' AND handle IN (?, ?, ?, ?, ?)`,
    UHERO_GEOS.map((g) => g.handle),
  );
  const defs = UHERO_GEOS.map((g): GeoDef => {
    const u = uhero.find((r) => r.handle === g.handle);
    if (!u) {
      console.warn(
        `  UHERO has no ${g.handle} geography; using built-in values`,
      );
      return g;
    }
    return {
      handle: g.handle,
      displayName: u.display_name,
      displayNameShort: u.display_name_short,
      fips: u.fips,
      geotype: u.geotype,
      listOrder: u.list_order,
    };
  });
  if (handles.has(UNK_GEO.handle)) defs.push(UNK_GEO);

  const ids = new Map<string, number>();
  for (const g of defs) {
    const values = [
      g.displayName,
      g.displayNameShort,
      g.fips,
      g.geotype,
      g.listOrder,
    ];
    let id = await findId(
      "SELECT id FROM geographies WHERE universe = ? AND handle = ? LIMIT 1",
      [DOTAX, g.handle],
    );
    if (id) {
      await rawQuery(
        `UPDATE geographies SET display_name = ?, display_name_short = ?, fips = ?, geotype = ?, list_order = ?, updated_at = NOW()
         WHERE id = ?`,
        [...values, id] as (string | number)[],
      );
    } else {
      id = await insertAndGetId(
        `INSERT INTO geographies (universe, handle, display_name, display_name_short, fips, geotype, list_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [DOTAX, g.handle, ...values],
      );
    }
    ids.set(g.handle, id);
  }
  return ids;
}

type LoaderSpec = { code: string; priority: number; scale: number };

/** A monthly series' file loader (and any extra loaders). */
function monthlyLoaders(s: SeriesSpec, unit: UnitDef): LoaderSpec[] {
  return [
    {
      code: `"${s.name}".tsn.load_from("${DATA_FILE}")`,
      priority: LOADER_PRIORITY,
      scale: unit.scale,
    },
    ...(EXTRA_LOADERS[s.name] ?? []).map((l) => ({ ...l, scale: 1 })),
  ];
}

/** Create the wanted loaders if missing; fix a drifted scale. */
async function ensureLoaders(
  seriesId: number,
  want: LoaderSpec[],
): Promise<number> {
  const existing = await LoaderCollection.getBySeriesId(seriesId);
  let created = 0;
  for (const w of want) {
    const found = existing.find((l) => l.eval === w.code);
    if (found) {
      if (parseFloat(found.scale) !== w.scale)
        await LoaderCollection.update(found.id, { scale: String(w.scale) });
      continue;
    }
    await LoaderCollection.create({
      seriesId,
      code: w.code,
      priority: w.priority,
      scale: w.scale,
      presaveHook: "",
      clearBeforeLoad: false,
      pseudoHistory: false,
      universe: DOTAX,
    });
    created++;
  }
  return created;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const info = readInfo();
  const reader = DataFileReader.fromFile(DATA_FILE);
  if (reader.frequency !== "month")
    throw new Error(
      `${DATA_FILE}: expected monthly data, got ${reader.frequency}`,
    );

  const { measurements, lists, skipped, errors, warnings } = plan(info, reader);

  const series = [...measurements.values()].flatMap((m) => m.series);
  const aggregateCount = series.length * AGGREGATES.length;
  const listed = new Set(
    lists.flatMap((s) => s.lists.flatMap((l) => l.rows.map(([p]) => p))),
  );
  console.log(`${INFO_FILE}: ${info.length} series`);
  console.log(
    `Plan: ${lists.length} sections, ${lists.reduce((n, s) => n + s.lists.length, 0)} data lists, ` +
      `${measurements.size} measurements (${measurements.size - [...measurements.keys()].filter((p) => listed.has(p)).length} unlisted), ` +
      `${series.length} monthly series + ${aggregateCount} quarterly/annual, ` +
      `${series.length + aggregateCount + series.filter((s) => EXTRA_LOADERS[s.name]).length} loaders`,
  );
  if (skipped.length) {
    console.log(
      `Skipping ${skipped.length} series with < ${MIN_OBSERVATIONS} observations (--include-sparse to keep):`,
    );
    for (const s of skipped) console.log(`  ${s.name} (${s.observations})`);
  }
  for (const w of warnings) console.log(`  note: ${w}`);
  if (VERBOSE) {
    for (const sec of lists) {
      console.log(`\n${sec.name}`);
      for (const list of sec.lists) {
        console.log(`  ${list.name}`);
        for (const [p, indent] of list.rows) {
          const m = measurements.get(p)!;
          const geos = m.series.map((s) => s.geo).join(",");
          console.log(
            `    ${"  ".repeat(indent)}${m.portalName}  [${m.prefix}: ${geos}]`,
          );
        }
      }
    }
  }
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  if (DRY_RUN) {
    console.log("\n--dry-run: nothing written.");
    process.exit(0);
  }

  // ── Universe, geographies, units, source ─────────────────────────
  if (
    !(await rawQuery("SELECT name FROM universe WHERE name = ?", [DOTAX]))[0]
  ) {
    await rawQuery("INSERT INTO universe (name, description) VALUES (?, ?)", [
      DOTAX,
      "Department of Taxation",
    ]);
  }
  const geoIds = await ensureGeographies(new Set(series.map((s) => s.geo)));
  const hiId = geoIds.get("HI")!;

  const unitIds = new Map<UnitDef, number>();
  for (const u of new Set([...measurements.values()].map((m) => m.unit))) {
    unitIds.set(
      u,
      await upsertId(
        "SELECT id FROM units WHERE universe = ? AND short_label = ? AND long_label = ? LIMIT 1",
        [DOTAX, u.shortLabel, u.longLabel],
        "INSERT INTO units (universe, short_label, long_label, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
        [DOTAX, u.shortLabel, u.longLabel],
      ),
    );
  }
  const sourceId = await upsertId(
    "SELECT id FROM sources WHERE universe = ? AND description = ? LIMIT 1",
    [DOTAX, SOURCE.description],
    "INSERT INTO sources (universe, description, link, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
    [DOTAX, SOURCE.description, SOURCE.link],
  );
  const portalDetailId = await upsertId(
    "SELECT id FROM source_details WHERE universe = ? AND description = ? LIMIT 1",
    [DOTAX, PORTAL_DETAIL],
    "INSERT INTO source_details (universe, description, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
    [DOTAX, PORTAL_DETAIL],
  );
  console.log(
    `Geographies: ${[...geoIds.keys()].join(", ")}; units: ${unitIds.size}; source: ${sourceId}`,
  );

  // ── Measurements, series, loaders ────────────────────────────────
  const measurementIds = new Map<string, number>();
  const stats = {
    measurements: { created: 0, updated: 0 },
    series: { created: 0, updated: 0 },
    loaders: 0,
  };
  for (const m of measurements.values()) {
    const unitId = unitIds.get(m.unit)!;
    const fields = {
      dataPortalName: m.portalName,
      unitId,
      sourceId,
      sourceDetailId: null,
      decimals: m.unit.decimals,
      percent: false,
      seasonalAdjustment: "not_seasonally_adjusted" as const,
      sourceLink: m.sourceLink,
      notes: m.notes,
    };
    let measurementId = await findId(
      "SELECT id FROM measurements WHERE universe = ? AND prefix = ? LIMIT 1",
      [DOTAX, m.prefix],
    );
    if (measurementId) {
      await MeasurementCollection.update(measurementId, fields);
      stats.measurements.updated++;
    } else {
      measurementId = (
        await MeasurementCollection.create({
          prefix: m.prefix,
          universe: DOTAX,
          ...fields,
        })
      ).id;
      stats.measurements.created++;
    }
    measurementIds.set(m.filePrefix, measurementId);

    for (const s of m.series) {
      const sFields = {
        dataPortalName: m.portalName,
        description: describeSeries(s.info),
        decimals: m.unit.decimals,
        unitId,
        sourceId,
        sourceDetailId: s.info.source.includes("Collections Portal")
          ? portalDetailId
          : null,
        sourceLink: reportLink(s.info),
        investigationNotes: investigationNotes(s),
      };
      const want = [
        {
          name: s.name,
          frequency: "month",
          depth: LOADER_INPUTS.has(s.name) ? 2 : 1,
          loaders: monthlyLoaders(s, m.unit),
        },
        ...aggregates(s).map((a) => ({
          name: a.name,
          frequency: a.frequency,
          depth: 0,
          loaders: [{ code: a.code, priority: LOADER_PRIORITY, scale: 1 }],
        })),
      ];
      for (const w of want) {
        let row = await SeriesCollection.findByNameAndUniverse(w.name, DOTAX);
        if (row) {
          await SeriesCollection.update(row.id!, sFields);
          stats.series.updated++;
        } else {
          row = await SeriesCollection.create({
            name: w.name,
            universe: DOTAX,
            geographyId: geoIds.get(s.geo)!,
            frequency: w.frequency,
            seasonalAdjustment: "not_seasonally_adjusted",
            percent: false,
            ...sFields,
          });
          stats.series.created++;
        }
        await rawQuery("UPDATE series SET dependency_depth = ? WHERE id = ?", [
          w.depth,
          row.id!,
        ]);
        await MeasurementCollection.addSeries(measurementId, row.id!);
        stats.loaders += await ensureLoaders(row.id!, w.loaders);
      }
    }
  }
  console.log(
    `Measurements: ${stats.measurements.created} created, ${stats.measurements.updated} updated; ` +
      `series: ${stats.series.created} created, ${stats.series.updated} updated; loaders: ${stats.loaders} created`,
  );

  // ── Category tree + data lists ───────────────────────────────────
  const rootId = await upsertId(
    "SELECT id FROM categories WHERE universe = ? AND ancestry IS NULL LIMIT 1",
    [DOTAX],
    `INSERT INTO categories (universe, name, list_order, meta, hidden, masked, header, default_freq, created_at, updated_at)
     VALUES (?, 'Department of Taxation', 0, 'DOTAX', 0, 0, 0, 'M', NOW(), NOW())`,
    [DOTAX],
  );
  let dataLists = 0;
  for (let si = 0; si < lists.length; si++) {
    const sec = lists[si];
    const secMeta = `DOTAX_S_${sec.key}`;
    const secId = await upsertId(
      "SELECT id FROM categories WHERE universe = ? AND meta = ? LIMIT 1",
      [DOTAX, secMeta],
      `INSERT INTO categories (universe, name, ancestry, list_order, meta, hidden, masked, header, default_geo_id, default_freq, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?, 'M', NOW(), NOW())`,
      [DOTAX, sec.name, String(rootId), si, secMeta, hiId],
    );
    await rawQuery(
      "UPDATE categories SET name = ?, ancestry = ?, list_order = ?, updated_at = NOW() WHERE id = ?",
      [sec.name, String(rootId), si, secId],
    );

    for (let li = 0; li < sec.lists.length; li++) {
      const list = sec.lists[li];
      const meta = `DOTAX_L_${list.key}`;
      const ancestry = `${rootId}/${secId}`;
      const description = list.description ?? null;
      const cat = (
        await rawQuery<{ id: number; data_list_id: number | null }>(
          "SELECT id, data_list_id FROM categories WHERE universe = ? AND meta = ? LIMIT 1",
          [DOTAX, meta],
        )
      )[0];
      let dataListId = cat?.data_list_id ?? null;
      if (!dataListId) {
        dataListId = await insertAndGetId(
          "INSERT INTO data_lists (universe, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
          [DOTAX, list.name],
        );
      }
      if (cat) {
        await rawQuery(
          `UPDATE categories SET name = ?, ancestry = ?, list_order = ?, description = ?, data_list_id = ?, updated_at = NOW()
           WHERE id = ?`,
          [list.name, ancestry, li, description, dataListId, cat.id] as (
            string | number
          )[],
        );
        await rawQuery(
          "UPDATE data_lists SET name = ?, updated_at = NOW() WHERE id = ?",
          [list.name, dataListId],
        );
      } else {
        await insertAndGetId(
          `INSERT INTO categories (universe, name, ancestry, list_order, meta, description, data_list_id, hidden, masked, header, default_geo_id, default_freq, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 'M', NOW(), NOW())`,
          [DOTAX, list.name, ancestry, li, meta, description, dataListId, hiId],
        );
      }

      const keep: number[] = [];
      for (let ri = 0; ri < list.rows.length; ri++) {
        const [p, indent] = list.rows[ri];
        const measurementId = measurementIds.get(p)!;
        keep.push(measurementId);
        await rawQuery(
          `INSERT INTO data_list_measurements (data_list_id, measurement_id, list_order, indent)
           VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE list_order = VALUES(list_order), indent = VALUES(indent)`,
          [dataListId, measurementId, ri, `indent${indent}`],
        );
      }
      // Rows taken out of the config since the last run.
      await rawQuery(
        `DELETE FROM data_list_measurements WHERE data_list_id = ? AND measurement_id NOT IN (${keep.map(() => "?").join(", ")})`,
        [dataListId, ...keep],
      );
      dataLists++;
    }
  }
  console.log(
    `Categories: root ${rootId}, ${lists.length} sections, ${dataLists} data lists`,
  );

  console.log(
    `\nDone. Loaders read ${DATA_FILE} under DATA_DIR and have not been run; reload the DOTAX series to load data (the quarterly/annual aggregates depend on the monthly series).`,
  );
  process.exit(0);
}

// Top-level await: with a floating promise Bun can exit 0 mid-query.
try {
  await main();
} catch (err) {
  console.error("Fatal error:", err);
  process.exit(1);
}
