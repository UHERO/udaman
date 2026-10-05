/**
 * The RentHub CSV → renthub_listings column map, and the parsing of one CSV
 * record into SQL values.
 *
 * Parsing is strict: a value that does not fit its column's kind throws, so a
 * format change in a new delivery stops the load instead of writing NULLs.
 * The DDL in src/lib/hhdb/renthub_listings.sql must list these columns in this
 * order (renthub-listings-ddl.test.ts).
 */

export type RenthubKind =
  "text" | "int" | "decimal" | "flag" | "date" | "datetime";

export interface RenthubColumnSpec {
  /** Header in the vendor CSV. */
  csv: string;
  /** Column in renthub_listings. */
  column: string;
  kind: RenthubKind;
  /** Blank is an error rather than NULL. */
  required?: boolean;
  /** Vendor placeholder values stored as NULL. */
  nullValues?: readonly string[];
  /** Absent from the older (pre-2023-07-28) header. */
  newerOnly?: boolean;
  /** Data dictionary label / description (hhdb-data-dictionary.ts). */
  label: string;
  description: string;
  /**
   * Counted in freq_renthub_listings and shown on the Summary tab. Off for
   * free text and near-unique values, where a frequency table is noise.
   */
  summary?: boolean;
}

/** Placeholder the vendor uses for "no date" in `available at`. */
const EPOCH = "1970-01-01 00:00:00.0";

export const RENTHUB_COLUMNS: readonly RenthubColumnSpec[] = [
  {
    csv: "scraped timestamp",
    column: "scraped_at",
    kind: "datetime",
    required: true,
    label: "Scraped At",
    description:
      "When the vendor scraped the listing, on the vendor's clock (timezone unspecified, probably UTC — not Hawaii time). The listing's observation time; counted by year in the Summary tab.",
    summary: true,
  },
  {
    csv: "state",
    column: "state",
    kind: "text",
    required: true,
    label: "State",
    description: "Always HI: only the vendor's Hawaii file is loaded.",
  },
  {
    csv: "city",
    column: "city",
    kind: "text",
    label: "City",
    description: "City as the listing gives it.",
    summary: true,
  },
  {
    csv: "neighborhood",
    column: "neighborhood",
    kind: "text",
    label: "Neighborhood",
    description:
      "The vendor's neighborhood name. Oahu only (blank elsewhere), with a few strays from outside Hawaii.",
    summary: true,
  },
  {
    csv: "zip",
    column: "zip",
    kind: "text",
    label: "ZIP",
    description: "5-digit ZIP, or ZIP+4 on some listings.",
    summary: true,
  },
  {
    csv: "address",
    column: "address",
    kind: "text",
    nullValues: ["0"],
    label: "Address",
    description:
      'Street address as listed, often with the unit. The vendor placeholder "0" is stored as NULL.',
  },
  {
    csv: "company",
    column: "company",
    kind: "text",
    label: "Company",
    description:
      "Listing site or property manager (Zillow, HomeRiver Group, Greystar, ...). About half of listings have none.",
    summary: true,
  },
  {
    csv: "building type",
    column: "building_type",
    kind: "text",
    label: "Building Type",
    description:
      "As the vendor gives it, in several vocabularies that mean the same thing: apartment building / APT, house / SFR / Single Family House, condo / CON, TH / townhouse, plus unknown.",
    summary: true,
  },
  {
    csv: "beds",
    column: "beds",
    kind: "int",
    label: "Bedrooms",
    description: "Bedroom count; 0 is a studio.",
    summary: true,
  },
  {
    csv: "baths",
    column: "baths",
    kind: "decimal",
    label: "Bathrooms",
    description: "Bathroom count; .5 is a half bath.",
    summary: true,
  },
  {
    csv: "sqft",
    column: "sqft",
    kind: "int",
    label: "Square Feet",
    description:
      "Interior square feet (12% blank). The rare fractional values are rounded.",
    summary: true,
  },
  {
    csv: "rent price",
    column: "rent_price",
    kind: "decimal",
    required: true,
    label: "Rent",
    description:
      "Monthly asking rent in dollars. The vendor drops listings outside roughly $300–$20,000.",
    summary: true,
  },
  ...(
    [
      ["granite", "Granite Counters"],
      ["stainless", "Stainless Appliances"],
      ["pool", "Pool"],
      ["gym", "Gym"],
      ["doorman", "Doorman"],
      ["furnished", "Furnished"],
      ["laundry", "Laundry"],
      ["garage", "Garage"],
    ] as const
  ).map(([column, label]): RenthubColumnSpec => ({
    csv: column,
    column,
    kind: "flag",
    label,
    description: `Vendor's Y/N amenity flag, stored as 1/0. "N" often means not mentioned rather than absent.`,
    summary: true,
  })),
  {
    csv: "garage count",
    column: "garage_count",
    kind: "int",
    label: "Garage Spaces",
    description: "Garage spaces (86% blank).",
    summary: true,
  },
  {
    csv: "clubhouse",
    column: "clubhouse",
    kind: "flag",
    label: "Clubhouse",
    description: `Vendor's Y/N amenity flag, stored as 1/0. "N" often means not mentioned rather than absent.`,
    summary: true,
  },
  {
    csv: "latitude",
    column: "latitude",
    kind: "decimal",
    label: "Latitude",
    description:
      "Vendor geocode. Precision varies by listing — see coord_decimals. About 150 rows are geocoded outside Hawaii.",
  },
  {
    csv: "longitude",
    column: "longitude",
    kind: "decimal",
    label: "Longitude",
    description: "Vendor geocode; see latitude.",
  },
  {
    csv: "date posted",
    column: "date_posted",
    kind: "date",
    label: "Date Posted",
    description:
      "When the listing was posted, per the vendor. Counted by year in the Summary tab.",
    summary: true,
  },
  {
    csv: "description",
    column: "description",
    kind: "text",
    label: "Description",
    description:
      "Listing text, or a newline-separated amenity list on older listings.",
  },
  {
    csv: "year built",
    column: "year_built",
    kind: "int",
    label: "Year Built",
    description: "Year of construction (99% blank).",
    summary: true,
  },
  {
    csv: "available at",
    column: "available_at",
    kind: "datetime",
    nullValues: [EPOCH],
    label: "Available At",
    description:
      "Move-in date the listing advertises, on the vendor's clock. The vendor's 1970-01-01 placeholder is stored as NULL. Counted by year in the Summary tab.",
    summary: true,
  },
  {
    csv: "availability status",
    column: "availability_status",
    kind: "text",
    label: "Availability",
    description:
      "available, coming soon, unavailable, not available or unknown. Blank before mid-2023.",
    summary: true,
  },
  {
    csv: "unit id",
    column: "unit_id",
    kind: "int",
    newerOnly: true,
    label: "Unit ID",
    description:
      "The vendor's id for the rental unit, stable across relistings. Deliveries from 2023-07-28 on only.",
  },
  {
    csv: "property id",
    column: "property_id",
    kind: "int",
    newerOnly: true,
    label: "Property ID",
    description:
      "The vendor's id for the building / property. Deliveries from 2023-07-28 on only.",
  },
];

/** Columns the loader fills itself, ahead of the data columns. */
export const RENTHUB_LOADER_COLUMNS = [
  "id",
  "batch",
  // Parcel geocode from latitude / longitude + address (geocode.ts), filled in load.ts.
  "tmk",
  "tmk_match",
  "tmk_distance_m",
  "tmk_address",
  "coord_decimals",
] as const;

export const RENTHUB_COLUMN_NAMES = RENTHUB_COLUMNS.map((c) => c.column);

/** Every column an INSERT writes, in order. */
export const RENTHUB_INSERT_COLUMNS: string[] = [
  ...RENTHUB_LOADER_COLUMNS,
  ...RENTHUB_COLUMN_NAMES,
];

/** Position of a column in a parsed row. */
export const colIndex = (column: string): number => {
  const i = RENTHUB_INSERT_COLUMNS.indexOf(column);
  if (i < 0) throw new Error(`no renthub column ${column}`);
  return i;
};

export type SqlValue = string | number | null;

const DECIMAL = /^-?\d+(\.\d+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** "2026-01-14 17:58:24.775" or "2014-03-06 00:00:00.0". */
const DATETIME = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(\.\d{1,6})?$/;

export class RenthubParseError extends Error {}

function parseValue(spec: RenthubColumnSpec, raw: string): SqlValue {
  const v = raw.trim();
  if (v === "" || spec.nullValues?.includes(v)) {
    if (spec.required) throw new RenthubParseError(`${spec.csv} is blank`);
    return null;
  }
  const bad = () =>
    new RenthubParseError(
      `${spec.csv}: ${JSON.stringify(v.slice(0, 40))} is not a ${spec.kind}`,
    );
  switch (spec.kind) {
    case "text":
      return v;
    case "int":
      // Rounded: sqft is occasionally fractional ("751.904157737731").
      if (!DECIMAL.test(v)) throw bad();
      return Math.round(Number(v));
    case "decimal":
      // Passed as a string so MySQL does the DECIMAL rounding, not a float.
      if (!DECIMAL.test(v)) throw bad();
      return v;
    case "flag":
      if (v === "Y") return 1;
      if (v === "N") return 0;
      throw bad();
    case "date":
      if (!DATE.test(v)) throw bad();
      return v;
    case "datetime": {
      const m = DATETIME.exec(v);
      if (!m) throw bad();
      return m[1] + (m[2] ?? "");
    }
  }
}

/**
 * Header → column index, checked against RENTHUB_COLUMNS. Every known column
 * must be present (the two `newerOnly` ones may be missing) and an unknown
 * column is an error: a new vendor field needs a schema decision.
 */
export function mapHeader(header: string[]): Map<string, number> {
  const index = new Map(header.map((h, i) => [h.trim(), i]));
  if (!index.has("id"))
    throw new RenthubParseError(`header has no "id" column`);
  const known = new Set(["id", ...RENTHUB_COLUMNS.map((c) => c.csv)]);
  const unknown = [...index.keys()].filter((h) => !known.has(h));
  if (unknown.length)
    throw new RenthubParseError(`unknown column(s): ${unknown.join(", ")}`);
  const missing = RENTHUB_COLUMNS.filter(
    (c) => !c.newerOnly && !index.has(c.csv),
  );
  if (missing.length)
    throw new RenthubParseError(
      `missing column(s): ${missing.map((c) => c.csv).join(", ")}`,
    );
  return index;
}

/**
 * Decimal places of the less precise of the two raw coordinates. Stored
 * because DECIMAL(10,7) pads "21.325" to 21.3250000: 4 places is ~11 m, 3 is
 * ~110 m, too coarse to trust the parcel match.
 */
export function coordDecimals(lat: string, lon: string): number | null {
  const places = (v: string) => {
    const t = v.trim();
    if (!DECIMAL.test(t)) return null;
    return t.includes(".") ? t.length - t.indexOf(".") - 1 : 0;
  };
  const a = places(lat);
  const b = places(lon);
  return a === null || b === null ? null : Math.min(a, b);
}

/**
 * One CSV record → values in RENTHUB_INSERT_COLUMNS order. The tmk columns
 * are left NULL for the loader's geocode step.
 */
export function parseRecord(
  record: string[],
  index: Map<string, number>,
  batch: string,
): SqlValue[] {
  if (record.length !== index.size)
    throw new RenthubParseError(
      `expected ${index.size} fields, got ${record.length}`,
    );
  const id = record[index.get("id")!].trim();
  if (!/^\d+$/.test(id))
    throw new RenthubParseError(`id: ${JSON.stringify(id)} is not an integer`);
  const values: SqlValue[] = [
    Number(id),
    batch,
    null,
    null,
    null,
    null,
    coordDecimals(
      record[index.get("latitude")!],
      record[index.get("longitude")!],
    ),
  ];
  for (const spec of RENTHUB_COLUMNS) {
    const i = index.get(spec.csv);
    values.push(i === undefined ? null : parseValue(spec, record[i]));
  }
  return values;
}
