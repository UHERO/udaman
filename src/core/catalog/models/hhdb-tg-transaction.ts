/**
 * Read model for `tg_transactions` — recorded real-property documents from
 * the Title Guaranty API. Remote-only durable table (never part of the qpub
 * rebuild); canonical DDL in src/lib/hhdb/tg_transactions.sql.
 *
 * Column names are camelCase in the database, and the JSON keys, table
 * accessorKeys, sort params and data-dictionary keys all use that same
 * spelling, so one spec below drives every layer.
 *
 * Pure data + types: safe to import from client components.
 */

export type TgColumnKind = "int" | "money" | "text" | "date";

export interface TgColumnSpec {
  column: string;
  label: string;
  kind: TgColumnKind;
  description: string;
  /**
   * Counted into freq_tg_transactions for the Summary tab. Left off for
   * party / owner names and the free-text address and area strings, where
   * nearly every value is unique and a frequency table is noise, and for the
   * twenty-column valuation grid, whose per-column full scans of 3.7M rows
   * would dominate the weekly freq regeneration for little insight.
   */
  summary?: true;
}

const VALUATION_GRID: [column: string, label: string][] = [
  ["totalMarketValue", "Total Market Value"],
  ["buildingMarketValue", "Building Market Value"],
  ["landMarketValue", "Land Market Value"],
  ["buildingValue", "Building Value"],
  ["landValue", "Land Value"],
  ["totalAssessedValue", "Total Assessed Value"],
  ["buildingExemption", "Building Exemption"],
  ["landExemption", "Land Exemption"],
  ["totalExemption", "Total Exemption"],
  ["netValue", "Net Value"],
  ["totalNetValue", "Total Net Value"],
];

function valuationSpecs(prefix: "" | "current", when: string): TgColumnSpec[] {
  return VALUATION_GRID.map(([column, label]) => ({
    column: prefix
      ? `${prefix}${column.charAt(0).toUpperCase()}${column.slice(1)}`
      : column,
    label: prefix ? `Current ${label}` : label,
    kind: "money",
    description: `${label} of the parcel ${when}, as carried on the TG record.`,
  }));
}

/** Every column of tg_transactions in DDL order. */
export const TG_TRANSACTION_COLUMNS: readonly TgColumnSpec[] = [
  {
    column: "id",
    label: "ID",
    kind: "int",
    description: "Title Guaranty's document record id (primary key).",
  },
  {
    column: "taxKey",
    label: "Tax Key",
    kind: "text",
    description:
      "13-digit undashed parcel key (island, zone, section, plat, parcel, unit) — the same parcel as tmk without punctuation.",
  },
  {
    column: "tmk",
    label: "TMK",
    kind: "text",
    description:
      "Dashed Tax Map Key (e.g. 1-2-3-004-005-0006). Same format as the qPublic tables, so rows join to properties / parcels on tmk. Leading digit is the county: 1=Oahu, 2=Maui, 3=Hawaii, 4=Kauai; 9-9-9-… is TG's placeholder for documents with no parcel.",
    summary: true,
  },
  {
    column: "recDate",
    label: "Recorded",
    kind: "date",
    description:
      "Date the document was recorded with the Bureau of Conveyances. Summarized by year.",
    summary: true,
  },
  {
    column: "docType",
    label: "Document Type",
    kind: "text",
    description:
      "Recorded instrument type: MORTGAGE & FINANCING STATEMENT (most rows), DEED, APARTMENT DEED (FEE), SECOND MORTGAGE, ASSIGNMENT OF LEASE, QUITCLAIM DEED, AGREEMENT OF SALE, … Sales analysis uses the deed / apartment deed / condominium conveyance / agreement-of-sale types only.",
    summary: true,
  },
  {
    column: "firstPartyName",
    label: "First Party",
    kind: "text",
    description:
      "Grantor / mortgagor side of the document as recorded (seller or borrower).",
  },
  {
    column: "secondPartyName",
    label: "Second Party",
    kind: "text",
    description:
      "Grantee / mortgagee side of the document as recorded (buyer or lender).",
  },
  {
    column: "conveyanceAmount",
    label: "Conveyance Amount",
    kind: "money",
    description:
      "Sale price declared on the conveyance tax certificate. Zero or NULL for mortgages and other non-sale documents — only ~8% of rows carry a positive value.",
    summary: true,
  },
  {
    column: "considerationAmount",
    label: "Consideration",
    kind: "money",
    description:
      "Dollar amount of the document: the loan amount for mortgages, the price for deeds. Populated for far more rows than conveyanceAmount.",
    summary: true,
  },
  {
    column: "condoName",
    label: "Condo Name",
    kind: "text",
    description: "Condominium project name when the parcel is a unit.",
    summary: true,
  },
  {
    column: "taxClass",
    label: "Tax Class",
    kind: "text",
    description:
      "County real-property tax classification at the time of the record (RESIDENTIAL, OWNER-OCCUPIED, HOMEOWNER, RESIDENTIAL A, AGRICULTURE, …). Vocabularies differ by county.",
    summary: true,
  },
  {
    column: "transactionType",
    label: "Transaction Type",
    kind: "text",
    description: 'TG\'s financing flag: "Cash Only" or "Consumer Loan".',
    summary: true,
  },
  {
    column: "neighborhood",
    label: "Neighborhood",
    kind: "text",
    description: "TG neighborhood name for the parcel (about 400 values).",
    summary: true,
  },
  {
    column: "region",
    label: "Region",
    kind: "text",
    description:
      "TG region grouping of neighborhoods (Honolulu, EwaPlain, PearlCity, DiamondHd, Kaneohe, …). Oahu-centric; blank for most neighbor-island rows.",
    summary: true,
  },
  {
    column: "ownerName",
    label: "Owner Name",
    kind: "text",
    description: "Assessed owner of record for the parcel.",
  },
  {
    column: "lessee",
    label: "Lessee",
    kind: "text",
    description: "Lessee of record for leasehold parcels.",
  },
  {
    column: "mailingAddress",
    label: "Mailing Address",
    kind: "text",
    description:
      "Owner's mailing street address. With mailingState this is what the out-of-state buyer charts key on.",
  },
  {
    column: "mailingApartmentNo",
    label: "Mailing Apt",
    kind: "text",
    description: "Unit / apartment number of the owner's mailing address.",
  },
  {
    column: "mailingCity",
    label: "Mailing City",
    kind: "text",
    description: "City of the owner's mailing address.",
    summary: true,
  },
  {
    column: "mailingState",
    label: "Mailing State",
    kind: "text",
    description:
      "State / province of the owner's mailing address (HI for resident owners). Anything other than HI is treated as an out-of-state owner.",
    summary: true,
  },
  {
    column: "mailingZipCode",
    label: "Mailing Zip",
    kind: "text",
    description: "Postal code of the owner's mailing address.",
    summary: true,
  },
  {
    column: "mailingCountry",
    label: "Mailing Country",
    kind: "text",
    description:
      "Country of the owner's mailing address. Blank for most domestic rows; populated mainly for foreign owners.",
    summary: true,
  },
  ...valuationSpecs("", "in the assessment year of the record"),
  ...valuationSpecs("current", "in the current assessment year"),
  {
    column: "propertyAddress",
    label: "Property Address",
    kind: "text",
    description: "Situs address of the parcel.",
  },
  {
    column: "zoning",
    label: "Zoning",
    kind: "text",
    description: "County zoning code. Not populated by the TG feed to date.",
  },
  {
    column: "propertyArea",
    label: "Property Area",
    kind: "text",
    description:
      'Land area as a unit-suffixed string ("5000SF", "1.000AC"), not a number.',
  },
  {
    column: "mortgageType",
    label: "Mortgage Type",
    kind: "text",
    description:
      "Loan program for mortgage documents: Conventional, Consumer Loan, Veterans Administration, FHA, Purchase Money Mortgage, … Blank for non-mortgage documents.",
    summary: true,
  },
  {
    column: "maturityDate",
    label: "Maturity Date",
    kind: "date",
    description:
      "Loan maturity date for mortgage documents. Summarized by year.",
    summary: true,
  },
];

export const TG_TRANSACTION_COLUMN_NAMES: readonly string[] =
  TG_TRANSACTION_COLUMNS.map((c) => c.column);

/**
 * Columns the list view can sort on: exactly the single-column indexes in
 * tg_transactions.sql (plus the primary key). The table is ~3.7M rows / 2.3 GB
 * against a 1.2 GB buffer pool, so ORDER BY on anything unindexed is a
 * multi-second (cold: multi-minute) filesort of the whole table.
 */
export const TG_SORTABLE_COLUMNS: readonly string[] = [
  "id",
  "recDate",
  "tmk",
  "taxKey",
  "neighborhood",
  "mailingState",
  "mailingZipCode",
];

type KindValue<K extends TgColumnKind> = K extends "int" | "money"
  ? number | null
  : string | null;

export type HhdbTgTransactionJSON = {
  id: number;
} & {
  [C in (typeof TG_TRANSACTION_COLUMNS)[number] as C["column"]]: KindValue<
    C["kind"]
  >;
};

export type HhdbTgTransactionAttrs = Record<string, unknown>;

function toText(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** DATE column → "YYYY-MM-DD" (the driver anchors DATEs at UTC midnight). */
function toDateOnly(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
}

export function hhdbTgTransactionRowToJSON(
  attrs: HhdbTgTransactionAttrs,
): HhdbTgTransactionJSON {
  const out: Record<string, unknown> = {};
  for (const col of TG_TRANSACTION_COLUMNS) {
    const v = attrs[col.column];
    switch (col.kind) {
      case "int":
      case "money":
        out[col.column] = toNumber(v);
        break;
      case "date":
        out[col.column] = toDateOnly(v);
        break;
      default:
        out[col.column] = toText(v);
    }
  }
  out.id = Number(attrs.id ?? 0);
  return out as HhdbTgTransactionJSON;
}
