/** One row of the DCCA index page. */
export interface DccaListEntry {
  /** Registration number — the key of the profile page. */
  reg: string;
  name: string;
  /** Second line of the index cell: a street address or a lot description. */
  addressLine: string | null;
  url: string;
}

/** One row of the "Condominium Filing Type" table on a profile page. */
export interface DccaFiling {
  /** e.g. "Developer's Public Report" */
  label: string;
  /** e.g. "Initial", "Annual Report", "Final", "Supplementary" */
  kind: string | null;
  file: string;
  url: string;
}

export type YesNo = "Yes" | "No";

/** Everything a profile page publishes, normalized. */
export interface DccaProfile {
  reg: string;
  name: string;
  /** "street, CITY, HI zip" as printed, with empty parts dropped. */
  address: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  developer: string | null;
  zoning: string | null;
  /** TMK exactly as printed: 9 digits, no county dashes, no CPR suffix. */
  tmkRaw: string | null;
  /** tmkRaw in the housing DB's dashed form, or null when it is not 9 digits. */
  tmk: string | null;
  buildings: number | null;
  floors: number | null;
  totalUnits: number | null;
  residential: number | null;
  commercial: number | null;
  agricultural: number | null;
  parking: number | null;
  toolSheds: number | null;
  other: number | null;
  ohana: YesNo | null;
  converted: YesNo | null;
  /** As printed, upper case: "FEE SIMPLE", "LEASEHOLD", … */
  landOwnership: string | null;
  filings: DccaFiling[];
  /** Labels the parser did not recognize — never silently dropped. */
  extra: Record<string, string>;
  url: string;
}

export class DccaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DccaParseError";
  }
}
