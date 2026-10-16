/**
 * Populates the DOTAX universe from the dotax extract (the parsed DOTAX
 * report files, src/core/ingest/sources/dotax):
 *
 * Creates or updates, in order: the universe row, geographies (copied from
 * UHERO, plus UNK for the GE liability reports' "Unknown district"
 * column), units, the DOTAX source, measurements, series + measurement
 * links, loaders, and categories (root → report family → one data list
 * per table). Idempotent: everything is keyed on (universe, name / prefix /
 * meta), so re-running after editing the config below updates rows in
 * place. Loaders are created but NOT run.
 *
 * Series and loaders: SERIES_MAP lists which DOTAX rows build which series
 * (type / section / item as the parser names them, the geography, an
 * optional month window). Each row becomes a loader
 *
 *   Series.load_from_extract("dotax", { type, tax, source, area })
 *
 * with the extract's printed labels (src/core/ingest/sources/dotax/labels),
 * trimmed to the window. A series is created where the extract has data.
 *
 * Naming (UHERO's DOTAX names, extended):
 *  - T for tax, then R (revenue: collections) or D (distribution /
 *    allocation), then a code for the line: two letters for one word
 *    (BO Boating), else the first letter of each word, up to three
 *    (TDCHC Community Health Centers), leaving out "Fund", "Special Fund",
 *    "and" and "&". A clash takes the second letter of the first word
 *    (TDCR Cancer Research, TDCOR Compliance Resolution). Names UHERO
 *    already uses are kept (TDCV Convention Center, TDTT TAT Trust).
 *  - Report families add a stem before the line code: TGB / TGR (GE base /
 *    collections, as UHERO), TGFB / TGFL (GE base / liabilities by filing
 *    period), TTFB / TTFL (TAT, by filing period), TRFU / TRFUS / TRFUC
 *    (fuel tax collections: total / state / county), TQFU (fuel
 *    quantities), TDFU / TDFUT (fuel tax allocation: amount / total tax),
 *    TRLI, TRTB (liquor, tobacco) and TDTB (tobacco tax allocations).
 *  - Monthly series end in NS (TDCRNS@HI.M), the measurement prefix drops
 *    it (TDCR), as in UHERO.
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
 * Every DOTAX unit is a flow, so all sum.
 *
 * Series with fewer than MIN_OBSERVATIONS points are skipped; measurements
 * left with no series are dropped from their lists.
 *
 * Descriptions and investigation notes come from
 * data-dir/dotax/dotax_series_info.csv (the rprocess dotax.R metadata)
 * where it has the row; it is optional.
 *
 * Usage: bun run scripts/create-dotax-universe.ts [--dry-run] [--verbose] [--include-sparse]
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import LoaderCollection from "@catalog/collections/loader-collection";
import MeasurementCollection from "@catalog/collections/measurement-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import Series from "@catalog/models/series";
import type { Universe } from "@catalog/types/shared";

import { seriesKey } from "@/core/ingest/extract-file";
import { latestExtract, matchSeries } from "@/core/ingest/load";
import { parseCsvRecords } from "@/core/ingest/sources/dotax/config";
import { dotaxDisplay, fixedLabel } from "@/core/ingest/sources/dotax/labels";
import { getDataDir } from "@/lib/data-dir";
import { insertAndGetId, rawQuery } from "@/lib/mysql/db";

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const INCLUDE_SPARSE = process.argv.includes("--include-sparse");

const DOTAX: Universe = "DOTAX";
const EXTRACTOR = "dotax";
/** Relative to DATA_DIR; metadata only. */
const INFO_FILE = "dotax/dotax_series_info.csv";
const MIN_OBSERVATIONS = 2;
const LOADER_PRIORITY = 100;
/** Loaders that fill months the series' own rows lack. */
const FILL_PRIORITY = 90;

const SOURCE = {
  description: "State of Hawaii Dept. of Taxation",
  link: "https://tax.hawaii.gov/",
};
const REPORTS_LINK = "https://tax.hawaii.gov/stats/a5_3txcolrpt/";

// ─── Units ───────────────────────────────────────────────────────────

type UnitDef = {
  shortLabel: string;
  longLabel: string;
  scale: number;
  decimals: number;
};

const UNITS = {
  dollars: {
    shortLabel: "$Thous",
    longLabel: "Thousands of current dollars",
    scale: 0.001,
    decimals: 1,
  },
  gallons: {
    shortLabel: "Gallons",
    longLabel: "Gallons",
    scale: 1,
    decimals: 0,
  },
  barrels: {
    shortLabel: "Barrels",
    longLabel: "Barrels (42 U.S. gallons)",
    scale: 1,
    decimals: 0,
  },
  mmbtu: {
    shortLabel: "MMBtu",
    longLabel: "Millions of British thermal units",
    scale: 1,
    decimals: 0,
  },
} satisfies Record<string, UnitDef>;

/** The fuel report's GALLONS column also carries barrels and MMBtu. */
function unitOf(c: Pick<Coord, "type" | "section" | "item">): UnitDef {
  if (c.type !== "fuels" || c.section !== "base_gallons") return UNITS.dollars;
  if (c.item === "ert_petroleum") return UNITS.barrels;
  if (c.item === "ert_fossil") return UNITS.mmbtu;
  return UNITS.gallons;
}

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

const GEOS = ["HI", "HON", "MAU", "HAW", "KAU", "UNK"];
const COUNTIES = ["HON", "MAU", "HAW", "KAU"];

// ─── Series map: DOTAX rows → series ─────────────────────────────────
//
// type / section / item are the parser's names (the extract's labels are
// looked up from them). geo: all, county, or one handle; the series id's
// {geo} takes the row's geography. from / to (YYYY-MM, inclusive) trim the
// loader. fill: the loader sits under the series' own rows.

/**
 * The collections report, and rows that build series out of several
 * reports. Started as rprocess dotax_series.csv (dotax.R's item → UDAMAN id
 * map).
 */
const SERIES_CSV = String.raw`type,section,item,geo,from,to,id,fill
collec,coll_total,total,all,,,TRNS@{geo}.M,
collec,collections,general_excise,all,,,TRGTNS@{geo}.M,
collec,collections,tat,all,,,TRTTNS@{geo}.M,
collec,collections,tat_fees,all,,,TRTFNS@{geo}.M,
collec,collections,ind_withholding,all,,,TRINWHNS@{geo}.M,
collec,collections,ind_decl_est,all,,,TRINESNS@{geo}.M,
collec,collections,ind_pay_returns,all,,,TRINPRNS@{geo}.M,
collec,collections,ind_refunds,all,,,TRINRFNS@{geo}.M,
collec,collections,corp_decl_est,all,,,TRCOESNS@{geo}.M,
collec,collections,corp_pay_returns,all,,,TRCOPRNS@{geo}.M,
collec,collections,corp_refunds,all,,,TRCORFNS@{geo}.M,
collec,collections,banks,all,,,TRFINS@{geo}.M,
collec,collections,conveyance,all,,,TRCVNS@{geo}.M,
collec,collections,employment_security,all,,,TREMNS@{geo}.M,
collec,collections,fuel,all,,,TRFUENS@{geo}.M,
collec,collections,environmental,all,,,TRENNS@{geo}.M,
collec,collections,fuel_environmental,all,,,TRFENS@{geo}.M,
collec,collections,ge_license,all,,,TRGLNS@{geo}.M,
collec,collections,inheritance,all,,,TRIHNS@{geo}.M,
collec,collections,insurance_premiums,all,,,TRISNS@{geo}.M,
collec,collections,insurance_fees,all,,,TRIFNS@{geo}.M,
collec,collections,liquor,HI,,,TRLINS@HI.M,
collec,collections,liquor,county,,2017-12,TRLINS@{geo}.M,
liqtob,liquor,total,county,2018-01,,TRLINS@{geo}.M,
liq,liquor,total,county,,,TRLINS@{geo}.M,
collec,collections,motor_vehicle,all,,2020-02,TRMTNS@{geo}.M,
collec,collections,motor_vehicle,HI,2020-03,,TRMTVRNS@HI.M,
collec,collections,rental_vehicle,HI,2020-03,,TRMTRVNS@HI.M,
collec,collections,public_service,all,,,TRPSNS@{geo}.M,
collec,collections,tobacco,HI,,,TRTBNS@HI.M,
collec,collections,tobacco,county,,2017-12,TRTBNS@{geo}.M,
liqtob,tobacco,total,county,2018-01,,TRTBNS@{geo}.M,
tob,tobacco,total,county,,,TRTBNS@{geo}.M,
collec,collections,county_surcharge,HI,,,TRHSNS@HI.M,
collec,collections,all_others,all,,,TROTNS@{geo}.M,
collec,county_surcharge,surcharge_hon,HI,,,TRHSNS@HON.M,
collec,county_surcharge,surcharge_haw,HI,,,TRHSNS@HAW.M,
collec,county_surcharge,surcharge_kau,HI,,,TRHSNS@KAU.M,
collec,county_surcharge,surcharge_mau,HI,,,TRHSNS@MAU.M,
collec,collections,county_surcharge,county,,,TRHSNS@{geo}.M,1
collec,county_surcharge,honolulu_surcharge,HI,2018-01,2018-12,TRHSNS@HON.M,1
collec,county_surcharge,surcharge_haw,HI,,,TRHASNS@HI.M,
collec,county_surcharge,surcharge_kau,HI,,,TRKSNS@HI.M,
collec,county_surcharge,surcharge_mau,HI,,,TRMSNS@HI.M,
collec,county_surcharge,honolulu_surcharge,HI,,,TRHCSNS@HI.M,
collec,county_surcharge,county_surcharges,HI,,,TRCSNS@HI.M,
collec,grand_total,grand_total,HI,,,TDNS@HI.M,
collec,distribution,subtotal,HI,,,TDSTNS@HI.M,
collec,distribution,general_fund,HI,,,TDGFNS@HI.M,
collec,distribution,agricultural_development_and_food_security_fund,HI,,,TDADFNS@HI.M,
collec,distribution,airport_fund,HI,,,TDAPNS@HI.M,
collec,distribution,boating_fund,HI,,,TDBONS@HI.M,
collec,distribution,cancer_research_fund,HI,,,TDCRNS@HI.M,
collec,distribution,cigarette_stamp_admin_fund,HI,,,TDCANS@HI.M,
collec,distribution,cigarette_stamp_enforcement_fund,HI,,,TDCENS@HI.M,
collec,distribution,community_health_centers_fund,HI,,,TDCHCNS@HI.M,
collec,distribution,compliance_resolution_fund,HI,,,TDCORNS@HI.M,
collec,distribution,convention_center_fund,HI,,,TDCVNS@HI.M,
collec,distribution,domestic_violence_fund,HI,,,TDDVCNS@HI.M,
collec,distribution,election_campaign_fund,HI,,,TDECNS@HI.M,
collec,distribution,electric_vehicle_charging_system_subaccount,HI,,,TDEVCNS@HI.M,
collec,distribution,emergency_medical_service_fund,HI,,,TDEMSNS@HI.M,
collec,distribution,employment_security_fund,HI,,,TDEMNS@HI.M,
collec,distribution,energy_security_fund,HI,,,TDESNS@HI.M,
collec,distribution,energy_systems_development_fund,HI,,,TDESDNS@HI.M,
collec,distribution,environmental_fund,HI,,,TDEVNS@HI.M,
collec,distribution,highway_fund,HI,,,TDHWNS@HI.M,
collec,distribution,hurricane_relief_fund,HI,,,TDHRNS@HI.M,
collec,distribution,hydrogen_fueling_system_subaccount,HI,,,TDHFSNS@HI.M,
collec,distribution,land_and_development_fund,HI,,,TDLDNS@HI.M,
collec,distribution,land_conservation_fund,HI,,,TDLCNS@HI.M,
collec,distribution,mass_transit_fund,HI,,,TDMTNS@HI.M,
collec,distribution,natural_area_reserve_fund,HI,,,TDNANS@HI.M,
collec,distribution,public_libraries_fund,HI,,,TDPLNS@HI.M,
collec,distribution,rental_housing_fund,HI,,,TDRHNS@HI.M,
collec,distribution,school_repairs_fund,HI,,,TDSMRNS@HI.M,
collec,distribution,tax_administration_fund,HI,,,TDTANS@HI.M,
collec,distribution,tat_trust_fund,HI,,,TDTTNS@HI.M,
collec,distribution,tourism_emergency_special_fund,HI,,,TDTENS@HI.M,
collec,distribution,tourism_special_fund,HI,,,TDTSNS@HI.M,
collec,distribution,trauma_system_fund,HI,,,TDTRSNS@HI.M,
collec,distribution,turtle_bay_conservation_easement_fund,HI,,,TDTBCNS@HI.M,
collec,county_revenue,county_revenue_total,HI,,,TDCTNS@HI.M,
collec,county_revenue,county_fuel_tax,HI,,,TDCTFUNS@HI.M,
collec,county_revenue,county_fuel_tax,HI,,,TRCTFUNS@HI.M,
collec,county_revenue,county_tat,HI,,,TDCTTTNS@HI.M,
collec,county_revenue,county_tat,HI,,,TRCTTTNS@HI.M,
fuels,alloc_total,county_fuel_tax,county,,,TDCTFUNS@{geo}.M,
fuels,alloc_total,county_fuel_tax_maui,MAU,,,TDCTFUNS@MAU.M,
fuels,alloc_total,county_fuel_tax,HI,,,TDFUTCTNS@HI.M,
ge,base,all_others_4,HI,,,TGBAONS@HI.M,
ge,collections,all_others_4,HI,,,TGRAONS@HI.M,
`;

/** GE business activities, by UHERO's TGB / TGR codes. */
const GE_ACTIVITIES: Record<string, string> = {
  grand_total: "",
  subtotal1: "4", // 4% activities
  retailing: "RT",
  services: "SV",
  contracting: "CT",
  theater: "TH",
  commissions: "CM",
  hotel_rentals: "HT",
  other_rentals: "OR",
  interest_all_others: "ITO",
  interest: "IT",
  all_others_4: "OT",
  use_4: "U4",
  subtotal2: "LR", // lower-rate activities
  producing: "PD",
  manufacturing: "MN",
  wholesaling: "WT",
  services_intermediary: "SI",
  services_wholesale: "SW",
  insurance_solicitors: "IS",
  use_half: "U5",
  sugar_processing: "SU",
  pineapple_canning: "PI",
  allocated: "AL",
  unallocated: "UA",
};

const TAT_LINES: Record<string, string> = {
  total: "",
  transient_accommodations: "TA",
  timeshare: "TS",
};

const FUEL_TYPES: Record<string, string> = {
  total: "",
  subtotal1: "FT", // fuel types
  gasoline: "GA",
  diesel_highway: "DH",
  diesel_off_highway: "DO",
  lpg_highway: "LH",
  lpg_off_highway: "LO",
  aviation: "AV",
  small_boat_gasoline: "BG",
  small_boat_diesel: "BD",
  other_fuel: "OF",
  subtotal2: "ER", // environmental response tax
  ert_petroleum: "EP",
  ert_fossil: "EF",
};

/** Fuel tax allocation funds; UHERO's TD codes where it has one. */
const FUEL_FUNDS: Record<string, string> = {
  total: "",
  subtotal1: "FT",
  highway_fund: "HW",
  airport_fund: "AP",
  boating_fund: "BO",
  general_fund: "GF",
  environmental_fund: "EV",
  energy_security_fund: "ES",
  energy_systems_fund: "ESD",
  agricultural_fund: "ADF",
  ev_charging_fund: "EVC",
  hydrogen_fund: "HFS",
  county_fuel_tax: "CT",
  county_fuel_tax_maui: "CTMA",
  county_fuel_tax_molokai: "CTMO",
  county_fuel_tax_lanai: "CTLA",
};
/** The TOTAL TAX column's county fuel tax rows are TDCTFU (SERIES_CSV). */
const FUEL_FUNDS_TOTAL = Object.fromEntries(
  Object.entries(FUEL_FUNDS).filter(([item]) => !item.startsWith("county_")),
);

const LIQUOR_LINES: Record<string, string> = {
  total: "TC",
  wholesale: "WH",
  permits: "PF",
  penalties: "PI",
};

const TOBACCO_LINES: Record<string, string> = {
  total: "TC",
  cigarettes: "CG",
  little_cigars: "LC",
  cigars: "CI",
  e_liquids: "EL",
  other_tobacco: "OT",
  licenses: "LF",
  retail_permits: "RP",
  penalties: "PI",
  unallocated: "UA",
};

/** Tobacco tax allocations; same codes as the collections report's funds. */
const TOBACCO_FUNDS: Record<string, string> = {
  fund_cancer_research: "CR",
  fund_cigarette_stamp_admin: "CA",
  fund_cigarette_stamp_enforcement: "CE",
  fund_community_health: "CHC",
  fund_emergency_medical: "EMS",
  fund_trauma: "TRS",
  fund_tobacco_enforcement: "TE",
};

/**
 * [type, section, stem, lines]: one series per line and geography, named
 * stem + line code. The liquor and tobacco reports split in July 2019
 * (liqtob through 2019-06; liq and tob from 2019-07), so both feed the
 * same series; the newer report is listed first (it supplies the
 * description).
 */
const FAMILIES: [string, string, string, Record<string, string>][] = [
  ["ge", "base", "TGB", GE_ACTIVITIES],
  ["ge", "collections", "TGR", GE_ACTIVITIES],
  ["liab_ge", "base", "TGFB", GE_ACTIVITIES],
  ["liab_ge", "liability", "TGFL", GE_ACTIVITIES],
  ["liab_tat", "base", "TTFB", TAT_LINES],
  ["liab_tat", "liability", "TTFL", TAT_LINES],
  ["fuels", "base_total", "TRFU", FUEL_TYPES],
  ["fuels", "base_state", "TRFUS", FUEL_TYPES],
  ["fuels", "base_county", "TRFUC", FUEL_TYPES],
  ["fuels", "base_gallons", "TQFU", FUEL_TYPES],
  ["fuels", "alloc_amount", "TDFU", FUEL_FUNDS],
  ["fuels", "alloc_total", "TDFUT", FUEL_FUNDS_TOTAL],
  ["liq", "liquor", "TRLI", LIQUOR_LINES],
  ["liqtob", "liquor", "TRLI", LIQUOR_LINES],
  ["tob", "tobacco", "TRTB", TOBACCO_LINES],
  ["liqtob", "tobacco", "TRTB", TOBACCO_LINES],
  ["tob", "tobacco", "TDTB", TOBACCO_FUNDS],
  ["liqtob", "tobacco", "TDTB", TOBACCO_FUNDS],
];

type MapRow = {
  type: string;
  section: string;
  item: string;
  geo: string;
  /** YYYY-MM, inclusive */
  from: string | null;
  to: string | null;
  id: string;
  fill: boolean;
  /** From FAMILIES: a line the report lacks is skipped, not an error */
  family: boolean;
};

function seriesMap(): MapRow[] {
  const rows: MapRow[] = parseCsvRecords(SERIES_CSV).map((r) => ({
    type: r.type,
    section: r.section,
    item: r.item,
    geo: r.geo,
    from: r.from || null,
    to: r.to || null,
    id: r.id,
    fill: r.fill === "1",
    family: false,
  }));
  for (const [type, section, stem, lines] of FAMILIES)
    for (const [item, code] of Object.entries(lines))
      rows.push({
        type,
        section,
        item,
        geo: "all",
        from: null,
        to: null,
        id: `${stem}${code}NS@{geo}.M`,
        fill: false,
        family: true,
      });
  return rows;
}

/** Continuity fills from dotax.R: [series prefix, part items]. */
const GE_FILLS: [string, string[]][] = [
  ["ITO", ["interest", "all_others_4"]],
  ["SI", ["services_wholesale"]],
];

/** Loaders beyond the DOTAX rows, by series name. */
const EXTRA_LOADERS: Record<string, { code: string; priority: number }[]> = {
  // Combined line through 2020-02; DOTAX splits it from 2020-03.
  "TRMTNS@HI.M": [
    {
      code: `"TRMTVRNS@HI.M".ts + "TRMTRVNS@HI.M".ts`,
      priority: FILL_PRIORITY,
    },
  ],
};

/**
 * Statewide series the DOTAX Collections Portal sheet supersedes where it
 * has values (dotax_collec.R source_to_id): [type, source, series]. Its
 * loader goes on top, and the series' other loaders step down 10, once the
 * dotax_sheet extractor has output; until then they are left out (rerun
 * this script after its first extraction).
 */
const SHEET_EXTRACTOR = "dotax_sheet";
const SHEET_SOURCES: [string, string, string][] = [
  ["Collection", "General Excise & Use", "TRGTNS@HI.M"],
  ["Collection", "Decl. of Est. Taxes-Ind", "TRINESNS@HI.M"],
  ["Collection", "Payment W/ Returns-Ind", "TRINPRNS@HI.M"],
  ["Collection", "WH Tax on Wages-Ind", "TRINWHNS@HI.M"],
  ["Collection", "Refunds-Ind", "TRINRFNS@HI.M"],
  ["Collection", "Decl. of Est. Taxes-Corp", "TRCOESNS@HI.M"],
  ["Collection", "Payment W/ Returns-Corp", "TRCOPRNS@HI.M"],
  ["Collection", "Refunds-Corp", "TRCORFNS@HI.M"],
  ["Collection", "Trans. Accomm. Tax/Time Share Occup. Tax", "TRTTNS@HI.M"],
  ["Collection", "County Surcharges", "TRHSNS@HI.M"],
  ["Distribution", "City and County of Honolulu", "TRHSNS@HON.M"],
  ["Distribution", "County of Hawaii", "TRHSNS@HAW.M"],
  ["Distribution", "County of Hawaii", "TRHASNS@HI.M"],
  ["Distribution", "County of Kauai", "TRHSNS@KAU.M"],
  ["Distribution", "County of Kauai", "TRKSNS@HI.M"],
  ["Distribution", "County of Maui", "TRHSNS@MAU.M"],
  ["Distribution", "County of Maui", "TRMSNS@HI.M"],
  ["Distribution", "State General Fund", "TDGFNS@HI.M"],
];

/**
 * Statewide series the sheet fills: [type, source, series]. Its loader goes
 * below the series' others, so the reports win wherever they print a value
 * and the sheet adds the months they don't: history back to 2000 (zeros
 * before a fund existed, which the reports never print) and preliminary
 * months. Matched by name and checked on values where both print a month.
 * Left out: the totals and sub-totals (no sheet line), TRHCS and TRCS (the
 * sheet's County Surcharges is TRHS, on top above), TRMT (Vehicle
 * Registration + Rental Vehicle, the sum loader above) and TRFE.
 */
const SHEET_FILLS: [string, string, string][] = [
  ["Collection", "All Others", "TROTNS@HI.M"],
  ["Collection", "Banks/Financial Corp", "TRFINS@HI.M"],
  ["Collection", "Conveyance", "TRCVNS@HI.M"],
  ["Collection", "Employment Sec. Contri.", "TREMNS@HI.M"],
  ["Collection", "Environmental", "TRENNS@HI.M"],
  ["Collection", "Fuel", "TRFUENS@HI.M"],
  ["Collection", "GE License/Fees", "TRGLNS@HI.M"],
  ["Collection", "Inheritance/Estate", "TRIHNS@HI.M"],
  ["Collection", "Insurance Fees", "TRIFNS@HI.M"],
  ["Collection", "Insurance Premiums", "TRISNS@HI.M"],
  ["Collection", "Liquor and Permits", "TRLINS@HI.M"],
  ["Collection", "Public Service Co.", "TRPSNS@HI.M"],
  ["Collection", "Rental Vehicle Tax", "TRMTRVNS@HI.M"],
  ["Collection", "Tobacco and Licenses", "TRTBNS@HI.M"],
  ["Collection", "Trans. Accomm./Time Share Occup. Fees", "TRTFNS@HI.M"],
  ["Collection", "Vehicle Registration Tax", "TRMTVRNS@HI.M"],
  // County shares: the sheet's label until 2020-06, then since 2025-09.
  ["Distribution", "Fuel Tax-County Funds", "TRCTFUNS@HI.M"],
  ["Distribution", "Fuel Tax", "TRCTFUNS@HI.M"],
  ["Distribution", "Fuel Tax-County Funds", "TDCTFUNS@HI.M"],
  ["Distribution", "Fuel Tax", "TDCTFUNS@HI.M"],
  ["Distribution", "Trans. Accomm. Tax-County Funds", "TRCTTTNS@HI.M"],
  ["Distribution", "Trans. Accomm. Tax-County Funds", "TDCTTTNS@HI.M"],
  [
    "Distribution",
    "Agricultural Development & Food Security Fund",
    "TDADFNS@HI.M",
  ],
  ["Distribution", "Boating Special Fund", "TDBONS@HI.M"],
  ["Distribution", "Cancer Research Fund", "TDCRNS@HI.M"],
  ["Distribution", "Cigarette Stamp Administrative Fund", "TDCANS@HI.M"],
  ["Distribution", "Cigarette Stamp Enforcement Fund", "TDCENS@HI.M"],
  ["Distribution", "Community Health Centers Fund", "TDCHCNS@HI.M"],
  ["Distribution", "Compliance Resolution Fund", "TDCORNS@HI.M"],
  ["Distribution", "Convention Center Enterprise Fund", "TDCVNS@HI.M"],
  [
    "Distribution",
    "Domestic Violence/Child Abuse and Neglect Funds",
    "TDDVCNS@HI.M",
  ],
  ["Distribution", "Election Campaign Fund", "TDECNS@HI.M"],
  [
    "Distribution",
    "Electric Vehicle Charging System Subaccount",
    "TDEVCNS@HI.M",
  ],
  ["Distribution", "Emergency Medical Service Fund", "TDEMSNS@HI.M"],
  ["Distribution", "Employment Security Fund", "TDEMNS@HI.M"],
  ["Distribution", "Energy Security Fund", "TDESNS@HI.M"],
  ["Distribution", "Energy Systems Development Fund", "TDESDNS@HI.M"],
  ["Distribution", "Environmental Fund", "TDEVNS@HI.M"],
  ["Distribution", "Hurricane Relief Fund", "TDHRNS@HI.M"],
  ["Distribution", "Hydrogen Fueling System Subaccount", "TDHFSNS@HI.M"],
  ["Distribution", "Land Conservation Fund", "TDLCNS@HI.M"],
  ["Distribution", "Land and Development Fund", "TDLDNS@HI.M"],
  ["Distribution", "Mass Transit Fund", "TDMTNS@HI.M"],
  ["Distribution", "Natural Area Reserve Fund", "TDNANS@HI.M"],
  ["Distribution", "Public Libraries Fund", "TDPLNS@HI.M"],
  ["Distribution", "Rental Housing Fund", "TDRHNS@HI.M"],
  ["Distribution", "School Minor Repairs & Maintenance Fund", "TDSMRNS@HI.M"],
  ["Distribution", "State Airport Fund", "TDAPNS@HI.M"],
  ["Distribution", "State Highway Fund", "TDHWNS@HI.M"],
  ["Distribution", "TAT Trust Fund", "TDTTNS@HI.M"],
  ["Distribution", "Tax Administration Fund", "TDTANS@HI.M"],
  ["Distribution", "Tourism Emergency Special Fund", "TDTENS@HI.M"],
  ["Distribution", "Tourism Special Fund", "TDTSNS@HI.M"],
  ["Distribution", "Trauma System Fund", "TDTRSNS@HI.M"],
  ["Distribution", "Turtle Bay Conservation Easement Fund", "TDTBCNS@HI.M"],
];

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

// ─── Category tree, data lists, portal names ─────────────────────────
//
// Rows are [measurement prefix, indent, portal name]. A measurement may
// sit in several lists; give its portal name on the first row and omit it
// after. Order and indent follow the DOTAX report layout (totals first,
// components indented).

type Row = [prefix: string, indent: 0 | 1 | 2 | 3, portalName?: string];
type ListDef = { key: string; name: string; description?: string; rows: Row[] };
type SectionDef = { key: string; name: string; lists: ListDef[] };

const GE_4PCT: [string, string][] = [
  ["RT", "Retailing"],
  ["SV", "Services"],
  ["CT", "Contracting"],
  ["TH", "Theater, Amusement, Radio, etc."],
  ["CM", "Commissions"],
  ["HT", "Hotel Rentals"],
  ["OR", "All Other Rentals"],
  ["ITO", "Interest & All Others"],
  ["IT", "Interest"],
  ["OT", "All Others (4%)"],
  ["U4", "Use (4%)"],
];
const GE_LOWER: [string, string][] = [
  ["PD", "Producing"],
  ["MN", "Manufacturing"],
  ["WT", "Wholesaling"],
  ["SI", "Services (Intermediary)"],
  ["SW", "Services (Wholesale)"],
  ["IS", "Insurance Solicitors"],
  ["U5", "Use (1/2%)"],
  ["SU", "Sugar Processing"],
  ["PI", "Pineapple Canning"],
];
/** Interest and All Others (4%) were printed separately until 2016-17 and sum to Interest & All Others. */
const geIndent = (code: string, base: 2 | 3): 0 | 1 | 2 | 3 =>
  code === "IT" || code === "OT" ? 3 : base;

/** A GE table's rows: total, 4% activities, lower-rate activities. */
function geRows(
  stem: string,
  label: string,
  indent: 0 | 1,
  totalName: string,
): Row[] {
  const i = (n: number) => (indent + n) as 0 | 1 | 2 | 3;
  return [
    [stem, indent, totalName],
    [`${stem}4`, i(1), `${label}: 4% Activities Subtotal`],
    ...GE_4PCT.map(([c, l]): Row => [
      `${stem}${c}`,
      geIndent(c, i(2) as 2 | 3),
      `${label}: ${l}`,
    ]),
    [`${stem}LR`, i(1), `${label}: Lower-Rate Activities Subtotal`],
    ...GE_LOWER.map(([c, l]): Row => [`${stem}${c}`, i(2), `${label}: ${l}`]),
  ];
}

const FUEL_TYPE_ROWS: [string, string][] = [
  ["GA", "Gasoline"],
  ["DH", "Diesel Oil (Highway)"],
  ["DO", "Diesel Oil (Off-Highway)"],
  ["LH", "Liquefied Petroleum Gas (Highway)"],
  ["LO", "Liquefied Petroleum Gas (Off-Highway)"],
  ["AV", "Aviation Fuel"],
  ["BG", "Small Boats (Gasoline)"],
  ["BD", "Small Boats (Diesel Oil)"],
  ["OF", "Other Fuel"],
];

const fuelTypes = (stem: string, label: string, indent: 0 | 1 | 2 | 3): Row[] =>
  FUEL_TYPE_ROWS.map(([c, l]) => [`${stem}${c}`, indent, `${label}: ${l}`]);

const ertRows = (stem: string, label: string): Row[] => [
  [`${stem}ER`, 1, `${label}: Environmental Response Tax Subtotal`],
  [`${stem}EP`, 2, `${label}: Environmental Response Tax, Petroleum Products`],
  [`${stem}EF`, 2, `${label}: Environmental Response Tax, Fossil Fuels`],
];

const SECTIONS: SectionDef[] = [
  {
    key: "COLLECTIONS",
    name: "Tax Collections & Distribution",
    lists: [
      {
        key: "COLLECTIONS",
        name: "Tax Collections by Source",
        rows: [
          ["TR", 0, "Total Tax Collections"],
          ["TRGT", 1, "General Excise & Use Tax Collections"],
          [
            "TRTT",
            1,
            "Transient Accommodations & Timeshare Occupancy Tax Collections",
          ],
          ["TRTF", 1, "Transient Accommodations & Timeshare Occupancy Fees"],
          ["TRINWH", 1, "Individual Income Tax: Withholding on Wages"],
          ["TRINES", 1, "Individual Income Tax: Declarations of Estimated Tax"],
          ["TRINPR", 1, "Individual Income Tax: Payments with Returns"],
          ["TRINRF", 1, "Individual Income Tax: Refunds"],
          ["TRCOES", 1, "Corporate Income Tax: Declarations of Estimated Tax"],
          ["TRCOPR", 1, "Corporate Income Tax: Payments with Returns"],
          ["TRCORF", 1, "Corporate Income Tax: Refunds"],
          ["TRFI", 1, "Banks & Financial Corporations Tax Collections"],
          ["TRCV", 1, "Conveyance Tax Collections"],
          ["TREM", 1, "Employment Security Contributions"],
          ["TRFUE", 1, "Fuel Tax Collections"],
          ["TREN", 1, "Environmental Response Tax Collections"],
          [
            "TRFE",
            1,
            "Fuel & Environmental Response Tax Collections (Jan-Feb 2020)",
          ],
          ["TRGL", 1, "General Excise Licenses & Fees"],
          ["TRIH", 1, "Inheritance & Estate Tax Collections"],
          ["TRIS", 1, "Insurance Premiums Tax Collections"],
          ["TRIF", 1, "Insurance Fees"],
          ["TRLI", 1, "Liquor Tax & Permit Collections"],
          ["TRMT", 1, "Motor Vehicle & Rental Vehicle Taxes & Fees"],
          ["TRMTVR", 2, "Motor Vehicle Taxes & Fees"],
          ["TRMTRV", 2, "Rental Vehicle Taxes & Fees"],
          ["TRPS", 1, "Public Service Company Tax Collections"],
          ["TRTB", 1, "Cigarette & Tobacco Tax Collections"],
          ["TRHS", 1, "County Surcharge on GE Tax"],
          ["TROT", 1, "All Other Tax Collections"],
        ],
      },
      {
        key: "DISTRIBUTION",
        name: "Distribution of Tax Collections",
        rows: [
          ["TD", 0, "Total Distribution of Tax Collections"],
          ["TDST", 1, "Distribution to State Funds, Subtotal"],
          ["TDGF", 2, "State General Fund"],
          ["TDADF", 2, "Agricultural Development & Food Security Fund"],
          ["TDAP", 2, "State Airport Fund"],
          ["TDBO", 2, "Boating Special Fund"],
          ["TDCR", 2, "Cancer Research Fund"],
          ["TDCA", 2, "Cigarette Stamp Administrative Fund"],
          ["TDCE", 2, "Cigarette Stamp Enforcement Fund"],
          ["TDCHC", 2, "Community Health Centers Fund"],
          ["TDCOR", 2, "Compliance Resolution Fund"],
          ["TDCV", 2, "Convention Center Enterprise Fund"],
          ["TDDVC", 2, "Domestic Violence & Child Abuse and Neglect Funds"],
          ["TDEC", 2, "Election Campaign Fund"],
          ["TDEVC", 2, "Electric Vehicle Charging System Subaccount"],
          ["TDEMS", 2, "Emergency Medical Service Fund"],
          ["TDEM", 2, "Employment Security Fund"],
          ["TDES", 2, "Energy Security Fund"],
          ["TDESD", 2, "Energy Systems Development Fund"],
          ["TDEV", 2, "Environmental Fund"],
          ["TDHW", 2, "State Highway Fund"],
          ["TDHR", 2, "Hurricane Relief Fund"],
          ["TDHFS", 2, "Hydrogen Fueling System Subaccount"],
          ["TDLD", 2, "Land and Development Fund"],
          ["TDLC", 2, "Land Conservation Fund"],
          ["TDMT", 2, "Mass Transit Fund"],
          ["TDNA", 2, "Natural Area Reserve Fund"],
          ["TDPL", 2, "Public Libraries Fund"],
          ["TDRH", 2, "Rental Housing Fund"],
          ["TDSMR", 2, "School Minor Repairs & Maintenance Fund"],
          ["TDTA", 2, "Tax Administration Fund"],
          ["TDTT", 2, "TAT Trust Fund"],
          ["TDTE", 2, "Tourism Emergency Special Fund"],
          ["TDTS", 2, "Tourism Special Fund"],
          ["TDTRS", 2, "Trauma System Fund"],
          ["TDTBC", 2, "Turtle Bay Conservation Easement Fund"],
          ["TRHS", 1],
          ["TDCT", 1, "Other County Revenue, Total"],
          ["TDCTFU", 2, "County Fuel Tax Revenue"],
          ["TDCTTT", 2, "County Share of Transient Accommodations Tax"],
        ],
      },
      {
        key: "COUNTY_SURCHARGE",
        name: "County Surcharge on GE Tax",
        description:
          "State of Hawaii is statewide county surcharge collections; each county is the surcharge distributed to that county.",
        rows: [
          ["TRHS", 0],
          ["TRHAS", 1, "County Surcharge Distributed to Hawaii County"],
          ["TRKS", 1, "County Surcharge Distributed to Kauai County"],
          ["TRMS", 1, "County Surcharge Distributed to Maui County"],
          ["TRHCS", 1, "Honolulu County Surcharge Distribution (2007-2018)"],
          [
            "TRCS",
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
        rows: geRows("TGB", "GE Tax Base", 0, "Total GE & Use Tax Base"),
      },
      {
        key: "GE_COLLECTIONS",
        name: "GE Tax Collections by Business Activity",
        rows: [
          ["TGR", 0, "Total GE & Use Tax Collections"],
          ["TGRAL", 1, "GE Tax Collections: Allocated"],
          ...geRows("TGR", "GE Tax Collections", 1, "").slice(1),
          ["TGRUA", 1, "GE Tax Collections: Unallocated"],
        ],
      },
      {
        key: "GE_LIAB_BASE",
        name: "GE Tax Base by Filing Period",
        description:
          "Tax base for GE and use tax liabilities incurred in the filing period (by period of activity rather than month collected).",
        rows: geRows(
          "TGFB",
          "GE Tax Base by Filing Period",
          0,
          "Total GE Tax Base, by Filing Period",
        ),
      },
      {
        key: "GE_LIAB",
        name: "GE Tax Liabilities by Filing Period",
        description:
          "GE and use tax liabilities incurred in the filing period (by period of activity rather than month collected).",
        rows: [
          ...geRows(
            "TGFL",
            "GE Tax Liabilities",
            0,
            "Total GE Tax Liabilities",
          ),
          ["TGFLUA", 1, "GE Tax Liabilities: Unallocated"],
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
          ["TTFB", 0, "Total TAT Base, by Filing Period"],
          ["TTFBTA", 1, "TAT Base by Filing Period: Transient Accommodations"],
          ["TTFBTS", 1, "TAT Base by Filing Period: Timeshare Occupancy"],
          ["TTFL", 0, "Total TAT Liabilities"],
          ["TTFLTA", 1, "TAT Liabilities: Transient Accommodations"],
          ["TTFLTS", 1, "TAT Liabilities: Timeshare Occupancy"],
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
          ["TQFUFT", 0, "Liquid Fuel Taxed: Total Gallons"],
          ...fuelTypes("TQFU", "Liquid Fuel Taxed", 1),
          [
            "TQFUEP",
            0,
            "Petroleum Products Subject to Environmental Response Tax",
          ],
          ["TQFUEF", 0, "Fossil Fuels Subject to Environmental Response Tax"],
        ],
      },
      {
        key: "FUEL_TOTAL",
        name: "Liquid Fuel Tax Collections, State & County",
        rows: [
          ["TRFU", 0, "Total Liquid Fuel Tax Collections"],
          ["TRFUFT", 1, "Fuel Tax Collections: Fuel Types Subtotal"],
          ...fuelTypes("TRFU", "Fuel Tax Collections", 2),
          ...ertRows("TRFU", "Fuel Tax Collections"),
        ],
      },
      {
        key: "FUEL_STATE",
        name: "Liquid Fuel Tax Collections, State Tax",
        rows: [
          ["TRFUS", 0, "Total State Fuel Tax Collections"],
          ["TRFUSFT", 1, "State Fuel Tax: Fuel Types Subtotal"],
          ...fuelTypes("TRFUS", "State Fuel Tax", 2),
          ...ertRows("TRFUS", "State Fuel Tax"),
        ],
      },
      {
        key: "FUEL_COUNTY",
        name: "Liquid Fuel Tax Collections, County Tax",
        rows: [
          ["TRFUC", 0, "Total County Fuel Tax Collections"],
          ["TRFUCFT", 1, "County Fuel Tax: Fuel Types Subtotal"],
          ...fuelTypes("TRFUC", "County Fuel Tax", 2),
        ],
      },
      {
        key: "FUEL_ALLOC",
        name: "Liquid Fuel Tax Allocation by Fund",
        description: "AMOUNT column of the fuel tax allocation table.",
        rows: [
          ["TDFUHW", 0, "Fuel Tax Allocation: State Highway Special Fund"],
          ["TDFUAP", 0, "Fuel Tax Allocation: State Airports Special Fund"],
          ["TDFUBO", 0, "Fuel Tax Allocation: State Boating Special Fund"],
          ["TDFUGF", 0, "Fuel Tax Allocation: General Fund"],
          [
            "TDFUEV",
            0,
            "Fuel Tax Allocation: Environmental Response Revolving Fund",
          ],
          ["TDFUES", 0, "Fuel Tax Allocation: Energy Security Special Fund"],
          [
            "TDFUESD",
            0,
            "Fuel Tax Allocation: Energy Systems Development Special Fund",
          ],
          [
            "TDFUADF",
            0,
            "Fuel Tax Allocation: Agricultural Development & Food Security Fund",
          ],
          [
            "TDFUEVC",
            0,
            "Fuel Tax Allocation: Electric Vehicle Charging System Subaccount",
          ],
          [
            "TDFUHFS",
            0,
            "Fuel Tax Allocation: Hydrogen Fueling System Subaccount",
          ],
          ["TDCTFU", 0],
          [
            "TDFUCTMA",
            1,
            "Fuel Tax Allocation: County Fuel Tax, Island of Maui",
          ],
          [
            "TDFUCTMO",
            1,
            "Fuel Tax Allocation: County Fuel Tax, Island of Molokai",
          ],
          [
            "TDFUCTLA",
            1,
            "Fuel Tax Allocation: County Fuel Tax, Island of Lanai",
          ],
          ["TDFUCT", 0, "Fuel Tax Allocation: County Fuel Tax"],
          ["TDFUFT", 0, "Fuel Tax Allocation: Fuel Types Subtotal"],
        ],
      },
      {
        key: "FUEL_ALLOC_TOTAL",
        name: "Liquid Fuel Tax Allocation, Total Tax",
        description: "TOTAL TAX column of the fuel tax allocation table.",
        rows: [
          ["TDFUT", 0, "Total Liquid Fuel Tax Allocated"],
          ["TDFUTFT", 1, "Fuel Tax Allocation, Total Tax: Fuel Types Subtotal"],
          ["TDCTFU", 1],
          ["TDFUTCT", 1, "Fuel Tax Allocation, Total Tax: County Fuel Tax"],
          [
            "TDFUTBO",
            1,
            "Fuel Tax Allocation, Total Tax: State Boating Special Fund",
          ],
          ["TDFUTGF", 1, "Fuel Tax Allocation, Total Tax: General Fund"],
          [
            "TDFUTEV",
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
        description:
          "From the liquor tax report (the combined liquor & tobacco report through June 2019).",
        rows: [
          ["TRLI", 0],
          ["TRLITC", 1, "Liquor Tax: Total Collections"],
          ["TRLIWH", 2, "Liquor Tax: Wholesale"],
          ["TRLIPF", 2, "Liquor Tax: Permit Fees"],
          ["TRLIPI", 2, "Liquor Tax: Penalties & Interest"],
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
        description:
          "From the tobacco tax report (the combined liquor & tobacco report through June 2019).",
        rows: [
          ["TRTB", 0],
          ["TRTBTC", 1, "Tobacco Tax: Total Net Collections"],
          ["TRTBCG", 2, "Tobacco Tax: Cigarettes"],
          ["TRTBLC", 2, "Tobacco Tax: Little Cigars"],
          ["TRTBCI", 2, "Tobacco Tax: Cigars"],
          ["TRTBEL", 2, "Tobacco Tax: E-Liquids"],
          ["TRTBOT", 2, "Tobacco Tax: All Other Tobacco Products"],
          ["TRTBLF", 2, "Tobacco Tax: License Fees"],
          ["TRTBRP", 2, "Tobacco Tax: Retail Permits"],
          ["TRTBPI", 2, "Tobacco Tax: Penalties & Interest"],
          ["TRTBUA", 2, "Tobacco Tax: Unallocated Net Collections"],
        ],
      },
      {
        key: "TOBACCO_FUNDS",
        name: "Cigarette & Tobacco Tax Special Fund Allocations",
        rows: [
          ["TDTBCR", 0, "Tobacco Tax Allocation: Hawaii Cancer Research Fund"],
          [
            "TDTBCA",
            0,
            "Tobacco Tax Allocation: Cigarette Stamp Administrative Fund",
          ],
          [
            "TDTBCE",
            0,
            "Tobacco Tax Allocation: Cigarette Stamp Enforcement Fund",
          ],
          [
            "TDTBCHC",
            0,
            "Tobacco Tax Allocation: Community Health Centers Fund",
          ],
          [
            "TDTBEMS",
            0,
            "Tobacco Tax Allocation: Emergency Medical Service Fund",
          ],
          ["TDTBTRS", 0, "Tobacco Tax Allocation: Trauma System Fund"],
          ["TDTBTE", 0, "Tobacco Tax Allocation: Tobacco Enforcement Fund"],
        ],
      },
    ],
  },
];

/**
 * Measurements created but kept off the data lists: each carries the same
 * values as a listed measurement under an older UHERO name, so listing
 * both would show duplicate rows.
 */
const UNLISTED: Record<string, string> = {
  TRCTFU: "County Fuel Tax Revenue",
  TRCTTT: "County Share of Transient Accommodations Tax",
  TGBAO: "GE Tax Base: All Others (4%)",
  TGRAO: "GE Tax Collections: All Others (4%)",
};

// ─── Extract labels ──────────────────────────────────────────────────

type Coord = {
  type: string;
  section: string;
  sub: string;
  item: string;
  geo: string;
};

/** The collections report splits individual and corporate income tax. */
function subOf(type: string, section: string, item: string): string {
  if (type !== "collec" || section !== "collections") return "";
  if (item.startsWith("corp_")) return "corp";
  if (item.startsWith("ind_")) return "ind";
  return "";
}

/** A row's labels in the extract, or null when the parser has no such row. */
function filtersOf(c: Coord): Record<string, string> | null {
  const label = fixedLabel(c.type, c.section, c.sub, c.item);
  if (label === null) return null;
  // c.type is checked by fixedLabel: only report types have labels
  const d = dotaxDisplay(c as Parameters<typeof dotaxDisplay>[0], label);
  return { type: c.type, tax: d.tax, source: d.source, area: d.area };
}

function extractCall(
  filters: Record<string, string>,
  from?: string | null,
  to?: string | null,
  handle = EXTRACTOR,
): string {
  const args = Object.entries(filters)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");
  let code = `Series.load_from_extract("${handle}", { ${args} })`;
  if (from || to) {
    const start = from ? `${from}-01` : "1000-01-01";
    code += to ? `.trim("${start}", "${to}-01")` : `.trim("${start}")`;
  }
  return code;
}

// ─── Info file (metadata only) ───────────────────────────────────────

type InfoRow = Record<string, string>;

function readInfo(): InfoRow[] {
  const path = join(getDataDir(), INFO_FILE);
  if (!existsSync(path)) {
    console.warn(`  ${INFO_FILE} not found: no descriptions or notes`);
    return [];
  }
  return parseCsvRecords(readFileSync(path, "utf-8").replace(/^\uFEFF/, ""));
}

const infoKey = (type: string, section: string, item: string, geo: string) =>
  `${type}|${section}|${item}|${geo}`;

// ─── Plan ────────────────────────────────────────────────────────────

type LoaderSpec = { code: string; priority: number; scale: number };

type SeriesSpec = {
  name: string;
  geo: string;
  coords: Coord[];
  loaders: LoaderSpec[];
  observations: number;
  info: InfoRow[];
};

type MeasurementSpec = {
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

type AggregateSpec = {
  name: string;
  frequency: "quarter" | "year";
  code: string;
};

const AGGREGATES = [
  { frequency: "quarter", suffix: "Q", period: ":quarter" },
  { frequency: "year", suffix: "A", period: ":year" },
] as const;

/** UHERO measurement prefixes drop the NS suffix (TGBCMNS@HI.M → TGBCM). */
const measurementPrefix = (name: string) =>
  name.split("@")[0].replace(/NS$/, "");

/** The quarterly and annual sums of a monthly series. */
function aggregates(s: SeriesSpec): AggregateSpec[] {
  const { prefix } = Series.parseName(s.name);
  return AGGREGATES.map((a) => ({
    name: `${a.suffix === "A" ? measurementPrefix(s.name) : prefix}@${s.geo}.${a.suffix}`,
    frequency: a.frequency,
    code: `"${s.name}".ts.aggregate(${a.period}, :sum)`,
  }));
}

/** "1/ Other fuel includes ..." → "Other fuel includes ..." */
const cleanFootnote = (f: string) => f.replace(/^\s*\d+\/\s*/, "").trim();

/** The DOTAX monthly reports page covers the collections, GE, fuel, liquor and tobacco reports. */
const reportLink = (type: string) =>
  type.startsWith("liab_") ? null : REPORTS_LINK;

function describeSeries(s: SeriesSpec, portalName: string): string | null {
  const i = s.info[0];
  if (!i) return clip(`${portalName}, ${s.geo}`, 500);
  const foot = cleanFootnote(i.footnote);
  return clip(foot ? `${i.name}. ${foot}` : i.name, 500);
}

function investigationNotes(s: SeriesSpec): string | null {
  const parts = s.info.flatMap((i) => [
    i.note ? `Note: ${i.note}.` : "",
    `Source: ${i.source}.`,
    `Table: ${i.report_title} > ${i.table} > ${i.column} > row "${i.row_label_variants}".`,
  ]);
  return clip(parts.filter(Boolean).join(" "), 500);
}

async function plan() {
  const errors: string[] = [];
  const warnings: string[] = [];

  const extract = await latestExtract(EXTRACTOR);
  const { dims, index } = extract;
  const used = new Set<string>();
  /** Points of an extract series inside a month window. */
  const pointsIn = (
    key: string,
    from: string | null,
    to: string | null,
  ): string[] =>
    [...(index.series.get(key)?.data.keys() ?? [])].filter(
      (d) => (!from || d >= `${from}-01`) && (!to || d <= `${to}-01`),
    );

  const info = readInfo();
  const infoById = new Map(info.map((r) => [r.id, r]));
  const infoByKey = new Map<string, InfoRow>();
  for (const r of info) {
    const k = infoKey(r.report_type, r.parse_section, r.parse_item, r.geo);
    if (!infoByKey.has(k)) infoByKey.set(k, r);
  }

  // Series from the map.
  const series = new Map<string, SeriesSpec & { dates: Set<string> }>();
  for (const row of seriesMap()) {
    const geos =
      row.geo === "all" ? GEOS : row.geo === "county" ? COUNTIES : [row.geo];
    for (const geo of geos) {
      const c: Coord = {
        type: row.type,
        section: row.section,
        sub: subOf(row.type, row.section, row.item),
        item: row.item,
        geo,
      };
      const filters = filtersOf(c);
      if (!filters) {
        if (row.family) break;
        errors.push(
          `SERIES_MAP: no DOTAX row ${row.type} / ${row.section} / ${row.item} (not in config/canonical)`,
        );
        break;
      }
      const key = seriesKey(dims, filters);
      const dates = pointsIn(key, row.from, row.to);
      if (dates.length === 0) continue;
      used.add(key);
      const name = row.id.replace("{geo}", geo);
      if (!Series.isValidName(name)) {
        errors.push(`Invalid series name: ${name}`);
        continue;
      }
      if (Object.values(filters).some((v) => v.includes('"')))
        errors.push(`${name}: a label contains a double quote`);
      let s = series.get(name);
      if (!s) {
        s = {
          name,
          geo: Series.parseName(name).geo,
          coords: [],
          loaders: [],
          observations: 0,
          info: [],
          dates: new Set(),
        };
        series.set(name, s);
      }
      s.coords.push(c);
      for (const d of dates) s.dates.add(d);
      const code = extractCall(filters, row.from, row.to);
      if (!s.loaders.some((l) => l.code === code))
        s.loaders.push({
          code,
          priority: row.fill ? FILL_PRIORITY : LOADER_PRIORITY,
          scale: unitOf(c).scale,
        });
      const i =
        infoById.get(name) ??
        infoByKey.get(infoKey(c.type, c.section, c.item, c.geo));
      if (i && !s.info.includes(i)) s.info.push(i);
    }
  }

  // Continuity fills and extra loaders.
  for (const s of series.values()) {
    const m = s.name.match(/^(TG[BR])([A-Z0-9]+)NS@([A-Z]+)\.M$/);
    const fill = m && GE_FILLS.find(([code]) => code === m[2]);
    if (m && fill) {
      const section = m[1] === "TGR" ? "collections" : "base";
      const parts = fill[1].map((item) =>
        filtersOf({ type: "ge", section, sub: "", item, geo: m[3] }),
      );
      if (parts.every((p) => p && index.series.has(seriesKey(dims, p))))
        s.loaders.push({
          code: parts.map((p) => extractCall(p!)).join(" + "),
          priority: FILL_PRIORITY,
          scale: UNITS.dollars.scale,
        });
    }
    for (const l of EXTRA_LOADERS[s.name] ?? [])
      s.loaders.push({ ...l, scale: 1 });
    s.observations = s.dates.size;
  }

  // The Collections Portal sheet: on top (SHEET_SOURCES), or underneath
  // (SHEET_FILLS).
  const sheet = await latestExtract(SHEET_EXTRACTOR).catch(() => null);
  if (!sheet)
    warnings.push(
      `${SHEET_EXTRACTOR} has no extract yet: ${SHEET_SOURCES.length + SHEET_FILLS.length} sheet loaders left out (rerun after its first extraction)`,
    );
  const sheetLoader = (type: string, source: string, name: string) => {
    const filters = { type, source };
    const match = matchSeries(
      SHEET_EXTRACTOR,
      sheet!.dims,
      sheet!.index,
      filters,
      {
        seriesName: name,
      },
    );
    const s = series.get(name);
    if (!match.ok || !s) {
      errors.push(`${name}: ${match.ok ? "no such series" : match.message}`);
      return null;
    }
    return { s, code: extractCall(filters, null, null, SHEET_EXTRACTOR) };
  };
  for (const [type, source, name] of sheet ? SHEET_SOURCES : []) {
    const found = sheetLoader(type, source, name);
    if (!found) continue;
    for (const l of found.s.loaders) l.priority -= 10;
    found.s.loaders.unshift({
      code: found.code,
      priority: LOADER_PRIORITY,
      scale: UNITS.dollars.scale,
    });
  }
  for (const [type, source, name] of sheet ? SHEET_FILLS : []) {
    const found = sheetLoader(type, source, name);
    if (!found) continue;
    const lowest = Math.min(...found.s.loaders.map((l) => l.priority));
    found.s.loaders.push({
      code: found.code,
      priority: lowest - 10,
      scale: UNITS.dollars.scale,
    });
  }

  for (const [key, s] of index.series)
    if (!used.has(key))
      warnings.push(
        `extract series not loaded: ${dims.map((d) => s.dims[d]).join(" / ")}`,
      );

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
  const mapped = new Set(
    seriesMap().map((r) => measurementPrefix(r.id.replace("{geo}", "X"))),
  );
  for (const p of portalNames.keys())
    if (!mapped.has(p))
      errors.push(`Config names ${p}, which SERIES_MAP lacks`);

  // Measurements.
  const skipped: SeriesSpec[] = [];
  const names = new Set<string>();
  const measurements = new Map<string, MeasurementSpec>();
  for (const s of series.values()) {
    if (!INCLUDE_SPARSE && s.observations < MIN_OBSERVATIONS) {
      skipped.push(s);
      continue;
    }
    const prefix = measurementPrefix(s.name);
    const portalName = portalNames.get(prefix);
    if (!portalName) {
      errors.push(
        `No portal name / list for ${prefix} (add it to SECTIONS or UNLISTED)`,
      );
      continue;
    }
    for (const n of [s.name, ...aggregates(s).map((a) => a.name)]) {
      if (!Series.isValidName(n)) errors.push(`Invalid series name: ${n}`);
      if (names.has(n)) errors.push(`Duplicate series name: ${n}`);
      names.add(n);
    }
    const units = new Set(s.coords.map((c) => unitOf(c)));
    let m = measurements.get(prefix);
    if (!m) {
      m = {
        prefix,
        portalName,
        unit: [...units][0],
        notes: null,
        sourceLink: reportLink(s.coords[0].type),
        series: [],
      };
      measurements.set(prefix, m);
    }
    units.add(m.unit);
    if (units.size > 1)
      errors.push(
        `${prefix}: mixed units ${[...units].map((u) => u.shortLabel).join(" / ")}`,
      );
    m.series.push(s);
  }
  for (const m of measurements.values()) {
    const footnotes = new Set(
      m.series.flatMap((s) =>
        s.info.map((i) => cleanFootnote(i.footnote)).filter(Boolean),
      ),
    );
    m.notes = clip([...footnotes].join(" "), 500);
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
            .join(", ")} (no series)`,
        );
      return { ...list, rows };
    }),
  }));
  const listed = new Set(
    lists.flatMap((sec) => sec.lists.flatMap((l) => l.rows.map(([p]) => p))),
  );
  for (const p of measurements.keys())
    if (!listed.has(p) && !(p in UNLISTED))
      errors.push(`${p} is in no data list (add it to SECTIONS or UNLISTED)`);

  // udaman's text columns are latin1; the config should stay ASCII.
  for (const m of measurements.values())
    if (/[^\x20-\x7e]/.test(m.portalName))
      errors.push(`Non-ASCII portal name: ${m.portalName}`);

  return {
    run: extract.run.id,
    measurements,
    lists,
    skipped,
    errors,
    warnings,
  };
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

/** Create the wanted loaders if missing; fix a drifted scale or priority. */
async function ensureLoaders(
  seriesId: number,
  want: LoaderSpec[],
): Promise<number> {
  const existing = await LoaderCollection.getBySeriesId(seriesId);
  let created = 0;
  for (const w of want) {
    const found = existing.find((l) => l.eval === w.code);
    if (found) {
      if (parseFloat(found.scale) !== w.scale || found.priority !== w.priority)
        await LoaderCollection.update(found.id, {
          scale: String(w.scale),
          priority: w.priority,
        });
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
  const { run, measurements, lists, skipped, errors, warnings } = await plan();

  const series = [...measurements.values()].flatMap((m) => m.series);
  const aggregateCount = series.length * AGGREGATES.length;
  const listed = new Set(
    lists.flatMap((s) => s.lists.flatMap((l) => l.rows.map(([p]) => p))),
  );
  const loaderCount = series.reduce((n, s) => n + s.loaders.length, 0);
  console.log(`Extract: ${EXTRACTOR} run #${run}`);
  console.log(
    `Plan: ${lists.length} sections, ${lists.reduce((n, s) => n + s.lists.length, 0)} data lists, ` +
      `${measurements.size} measurements (${measurements.size - [...measurements.keys()].filter((p) => listed.has(p)).length} unlisted), ` +
      `${series.length} monthly series + ${aggregateCount} quarterly/annual, ` +
      `${loaderCount + aggregateCount} loaders`,
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
    console.log("\nLoaders");
    for (const s of series)
      for (const l of s.loaders)
        console.log(`  ${s.name.padEnd(16)} ${l.priority}  ${l.code}`);
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
    measurementIds.set(m.prefix, measurementId);

    for (const s of m.series) {
      const sFields = {
        dataPortalName: m.portalName,
        description: describeSeries(s, m.portalName),
        decimals: m.unit.decimals,
        unitId,
        sourceId,
        sourceDetailId: null,
        sourceLink: reportLink(s.coords[0].type),
        investigationNotes: investigationNotes(s),
      };
      const want = [
        {
          name: s.name,
          frequency: "month",
          depth: LOADER_INPUTS.has(s.name) ? 2 : 1,
          loaders: s.loaders,
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
    `\nDone. Loaders read the ${EXTRACTOR} extract and have not been run; reload the DOTAX series to load data (the quarterly/annual aggregates depend on the monthly series).`,
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
