/**
 * FICOH homeowners policy / claim workbook → insurance_policies /
 * insurance_claims column maps, and strict parsing of one sheet row.
 *
 * Source: /Volumes/UHEROroot/datashare/ficoh/Data Set for Homeowners policy
 * and Loss.xlsx — sheets "Policy Data Set" and "Cmail Data Set" (sic). The
 * delivered columns differ from FICOH Data Dictionary and Sample.xlsx, which
 * describes a richer extract (Location_No, County, Protection Class,
 * Territory, reserves ...) than the one received; these specs follow the
 * delivered file.
 *
 * Parsing is strict: a value that does not fit its kind throws, so a changed
 * extract stops the load instead of writing NULLs. The DDL in
 * src/lib/hhdb/insurance.sql lists these columns in this order
 * (insurance-ddl.test.ts).
 *
 * Pure (no xlsx import): the data dictionary pulls these specs into client
 * bundles.
 */

export type FicohKind =
  "text" | "int" | "money" | "excelDate" | "ymdDate" | "zip";

export interface FicohColumnSpec {
  /** Header in the workbook. */
  source: string;
  /** Column in the table. */
  column: string;
  kind: FicohKind;
  /** Blank is an error rather than NULL. */
  required?: boolean;
  /** Placeholder values stored as NULL (compared as trimmed strings). */
  nullValues?: readonly string[];
  /** Data dictionary label / description (hhdb-data-dictionary.ts). */
  label: string;
  description: string;
  /** Counted in the freq_ table and shown on the Summary tab. */
  summary?: boolean;
}

const LIMIT = (letter: string, what: string): FicohColumnSpec => ({
  source: `HO_Cov${letter}_Limit`,
  column: `cov_${letter.toLowerCase()}_limit`,
  kind: "money",
  nullValues: ["NULL"],
  label: `Coverage ${letter} Limit`,
  description: `Coverage ${letter} limit in dollars: ${what}.${
    "EF".includes(letter)
      ? ' Blank on ~58% of rows (the extract\'s "NULL").'
      : ""
  }`,
  summary: true,
});

export const POLICY_COLUMNS: readonly FicohColumnSpec[] = [
  {
    source: "Policy_Number_Full",
    column: "policy_number",
    kind: "text",
    required: true,
    label: "Policy Number",
    description:
      "Policy number for this term. 15-character numbers (2020 on) are the 13-character policy_base plus a 2-digit term counter; 12-character numbers (2018–2020) are an older scheme. Several rows share a number when one policy covers several locations (location_no).",
  },
  {
    source: "Effective_Date",
    column: "effective_date",
    kind: "excelDate",
    required: true,
    label: "Effective Date",
    description:
      "Start of the policy term (2018-01-01 to 2025-06-30). Counted by year in the Summary tab.",
    summary: true,
  },
  {
    source: "Expiration_Date",
    column: "expiration_date",
    kind: "excelDate",
    required: true,
    label: "Expiration Date",
    description:
      "End of the policy term; almost always one year after the effective date.",
  },
  {
    source: "New_Renewal",
    column: "new_renewal",
    kind: "text",
    label: "New / Renewal",
    description: "N = new business, R = renewal.",
    summary: true,
  },
  {
    source: "HO_FormType",
    column: "form_type",
    kind: "text",
    label: "Form Type",
    description:
      "Homeowners form as FICOH codes it: Condo, Dwelling0, Dwelling6, Dwelling7, Tenant.",
    summary: true,
  },
  {
    source: "Address",
    column: "address",
    kind: "text",
    nullValues: ["NULL"],
    label: "Address",
    description:
      "Insured location, usually with unit and often with the city and HI appended.",
  },
  {
    source: "City",
    column: "city",
    kind: "text",
    nullValues: ["NULL"],
    label: "City",
    description:
      'FICOH\'s city / rating area name — some are combined, e.g. "Kihei, Wailea".',
    summary: true,
  },
  {
    source: "Zip",
    column: "zip",
    kind: "zip",
    label: "ZIP",
    description:
      '5-digit ZIP (ZIP+4 kept when present). Blank, "NULL" and padding-only values are NULL.',
    summary: true,
  },
  LIMIT("A", "dwelling"),
  LIMIT("B", "other structures"),
  LIMIT("C", "personal property"),
  LIMIT("D", "loss of use"),
  LIMIT("E", "personal liability"),
  LIMIT("F", "medical payments"),
  {
    source: "TIV",
    column: "tiv",
    kind: "money",
    label: "TIV",
    description: "Total insurable value in dollars.",
    summary: true,
  },
  {
    source: "Deductible",
    column: "deductible",
    kind: "int",
    label: "Deductible",
    description: "Policy deductible in dollars.",
    summary: true,
  },
  {
    source: "Premium",
    column: "premium",
    kind: "money",
    label: "Premium",
    description:
      "Written premium for the term in dollars. A few rows are negative (returned premium).",
    summary: true,
  },
  {
    source: "Hurricane_Premium",
    column: "hurricane_premium",
    kind: "money",
    label: "Hurricane Premium",
    description:
      "Hurricane portion of the premium in dollars; 0 on ~94% of rows.",
    summary: true,
  },
  {
    source: "Company_Code",
    column: "company_code",
    kind: "int",
    label: "Company Code",
    description:
      "FICOH underwriting company code (5, 7, 8, 10). No decode was provided.",
    summary: true,
  },
  {
    source: "Agency_Number",
    column: "agency_number",
    kind: "int",
    label: "Agency Number",
    description: "Selling agency code.",
    summary: true,
  },
  {
    source: "Producer_Key",
    column: "producer_key",
    kind: "text",
    label: "Producer Key",
    description:
      "Producer code within the agency: numbers and letter codes (DF, M7 ...).",
    summary: true,
  },
  {
    source: "Year_Built",
    column: "year_built",
    kind: "int",
    nullValues: ["1000", "9999"],
    label: "Year Built",
    description:
      "Year of construction. FICOH's placeholders 1000 and 9999 (~35% of rows, mostly condos and tenants) are stored as NULL.",
    summary: true,
  },
  {
    source: "Construction_Type",
    column: "construction_type",
    kind: "int",
    label: "Construction Type",
    description:
      "FICOH construction code (0, 1, 2, 6). No decode was provided.",
    summary: true,
  },
];

export const CLAIM_COLUMNS: readonly FicohColumnSpec[] = [
  {
    source: "Claim_Number",
    column: "claim_number",
    kind: "text",
    required: true,
    label: "Claim Number",
    description: "FICOH claim number; unique.",
  },
  {
    source: "Policy_Number_Full",
    column: "policy_number",
    kind: "text",
    required: true,
    label: "Policy Number",
    description:
      "Policy number as the claim records it. See policy_id for the matching insurance_policies row.",
  },
  {
    source: "Date_of_Loss",
    column: "date_of_loss",
    kind: "ymdDate",
    required: true,
    label: "Date of Loss",
    description:
      "Date the loss occurred (2020-08 to 2025-11). Counted by year in the Summary tab. 857 claims are dated 2023-08-08, the Lahaina fire.",
    summary: true,
  },
  {
    source: "Loss_Cause_Description",
    column: "loss_cause",
    kind: "text",
    label: "Loss Cause",
    description:
      "Cause of loss: Water Damage (61%), Wind, Fire, All Other Losses ...",
    summary: true,
  },
  {
    source: "Loss_Address",
    column: "loss_address",
    kind: "text",
    nullValues: ["Unknown", "Unk"],
    label: "Loss Address",
    description:
      'Street address of the loss. "Unknown" / "Unk" are stored as NULL.',
  },
  {
    source: "Loss_City",
    column: "loss_city",
    kind: "text",
    nullValues: ["Unknown", "Unk"],
    label: "Loss City",
    description: "City of the loss.",
    summary: true,
  },
  {
    source: "Loss_State",
    column: "loss_state",
    kind: "text",
    nullValues: ["Unknown"],
    label: "Loss State",
    description:
      "State of the loss; HI for 99%, a few mainland (renters' property away from home).",
    summary: true,
  },
  {
    source: "Loss_ZIP",
    column: "loss_zip",
    kind: "zip",
    nullValues: ["Unknown"],
    label: "Loss ZIP",
    description: "ZIP of the loss.",
    summary: true,
  },
  {
    source: "Paid_Loss",
    column: "paid_loss",
    kind: "money",
    label: "Paid Loss",
    description: "Loss paid to date in dollars, gross.",
    summary: true,
  },
  {
    source: "Incurred_Loss",
    column: "incurred_loss",
    kind: "money",
    label: "Incurred Loss",
    description:
      "Loss incurred in dollars: paid plus outstanding reserve (FICOH's definition).",
    summary: true,
  },
  {
    source: "Expense_Paid",
    column: "expense_paid",
    kind: "money",
    label: "Expense Paid",
    description: "Claim expense paid in dollars; 0 on 99% of claims.",
    summary: true,
  },
];

/** Workbook columns deliberately not stored (derivable from stored ones). */
export const CLAIM_IGNORED = ["Year_of_Loss", "Full_Loss_Address"] as const;

/** Loader-owned columns, ahead of the data columns. */
export const POLICY_LOADER_COLUMNS = [
  "id",
  "policy_base",
  "location_no",
  "tmk",
  "tmk_match",
  "tmk_address",
] as const;
export const CLAIM_LOADER_COLUMNS = [
  "policy_id",
  "policy_match",
  "tmk",
  "tmk_match",
  "tmk_address",
] as const;

export const POLICY_INSERT_COLUMNS: string[] = [
  ...POLICY_LOADER_COLUMNS,
  ...POLICY_COLUMNS.map((c) => c.column),
];
/** claim_number first: it is the primary key. */
export const CLAIM_INSERT_COLUMNS: string[] = [
  CLAIM_COLUMNS[0].column,
  ...CLAIM_LOADER_COLUMNS,
  ...CLAIM_COLUMNS.slice(1).map((c) => c.column),
];

export type SqlValue = string | number | null;
export type Cell = string | number | boolean | Date | null;

export class FicohParseError extends Error {}

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** "96753", "96753-    ", "96748-0000", 96753 → "96753"; "96740-8220" kept. */
export function normalizeZip(v: string): string | null {
  const m = /^(\d{5})(?:-(\d{4}))?(?:-\s*)?$/.exec(v.replace(/\s+$/, ""));
  if (!m) return null;
  return m[2] && m[2] !== "0000" ? `${m[1]}-${m[2]}` : m[1];
}

function parseCell(spec: FicohColumnSpec, raw: Cell): SqlValue {
  const v = raw === null ? "" : String(raw).trim();
  if (v === "" || spec.nullValues?.includes(v)) {
    if (spec.required) throw new FicohParseError(`${spec.source} is blank`);
    return null;
  }
  const bad = () =>
    new FicohParseError(
      `${spec.source}: ${JSON.stringify(v.slice(0, 40))} is not a ${spec.kind}`,
    );
  switch (spec.kind) {
    case "text":
      return v;
    case "int":
      if (!/^-?\d+$/.test(v)) throw bad();
      return Number(v);
    case "money":
      // Rounded to cents: TIV carries float noise ("1014999.585").
      if (!NUMERIC.test(v)) throw bad();
      return (Math.round(Number(v) * 100) / 100).toFixed(2);
    case "excelDate": {
      // Excel 1900-system serial → calendar date, no timezone involved.
      if (typeof raw !== "number" || !Number.isFinite(raw)) throw bad();
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(raw) * 864e5)
        .toISOString()
        .slice(0, 10);
      if (date < "1990-01-01" || date > "2100-12-31") throw bad();
      return date;
    }
    case "ymdDate": {
      const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
      if (!m) throw bad();
      const date = `${m[1]}-${m[2]}-${m[3]}`;
      if (isNaN(Date.parse(date))) throw bad();
      return date;
    }
    case "zip":
      // Junk ("ZIP+4", 4-digit, mainland PO formats) is NULL, not an error.
      return normalizeZip(v);
  }
}

/**
 * Header → column index for one sheet. Every spec column must be present;
 * an unknown named column is an error (a changed extract needs a schema
 * decision). Unnamed trailing columns are ignored.
 */
export function mapHeader(
  header: Cell[],
  specs: readonly FicohColumnSpec[],
  ignored: readonly string[] = [],
): Map<string, number> {
  const index = new Map<string, number>();
  header.forEach((h, i) => {
    const name = h === null ? "" : String(h).trim();
    if (name) index.set(name, i);
  });
  const known = new Set([...specs.map((s) => s.source), ...ignored]);
  const unknown = [...index.keys()].filter((h) => !known.has(h));
  if (unknown.length)
    throw new FicohParseError(`unknown column(s): ${unknown.join(", ")}`);
  const missing = specs.filter((s) => !index.has(s.source));
  if (missing.length)
    throw new FicohParseError(
      `missing column(s): ${missing.map((s) => s.source).join(", ")}`,
    );
  return index;
}

/** One sheet row → { column: value } for the spec columns. */
export function parseRow(
  row: Cell[],
  index: Map<string, number>,
  specs: readonly FicohColumnSpec[],
): Record<string, SqlValue> {
  const out: Record<string, SqlValue> = {};
  for (const spec of specs)
    out[spec.column] = parseCell(spec, row[index.get(spec.source)!] ?? null);
  return out;
}
