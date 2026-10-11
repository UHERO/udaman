/**
 * Data Book geography labels → DATABOOK universe geography handles.
 *
 * Handles follow UHERO conventions (HI, HON, HAW, KAU, MAU, MAUI, MOL, LAN),
 * extended with the islands UHERO has no handle for: OAHU, HAWI (Hawaii
 * Island), KAUI (Kauai Island), NII (Niihau), KAHO (Kahoolawe). Counties
 * and islands are distinct geographies: HON vs OAHU, MAU vs MAUI/MOL/LAN.
 * Assignment logic lives in geoassign.ts; the label maps below are only
 * used by the cross-edition matcher to canonicalize labels.
 * Deliberate simplifications (see docs/2026-10-10-databook-universe-plan.md):
 *  - "Maui County" with a Kalawao footnote is just MAU — Kalawao is never
 *    broken out as its own geography.
 *  - Island-level Oahu = HON, Hawaii island = HAW, Kauai island = KAU
 *    (Niihau's handful of residents are not split off).
 */
import { labelKey } from "./labels";

export interface DatabookGeo {
  handle: string;
  displayName: string;
  displayNameShort: string;
  fips: string | null;
  geotype: "state" | "county" | "island" | "nation";
  listOrder: number;
}

export const DATABOOK_GEOS: DatabookGeo[] = [
  {
    handle: "HI",
    displayName: "State of Hawaii",
    displayNameShort: "State of Hawaii",
    fips: "15",
    geotype: "state",
    listOrder: 0,
  },
  {
    handle: "HON",
    displayName: "City and County of Honolulu",
    displayNameShort: "Honolulu County",
    fips: "15003",
    geotype: "county",
    listOrder: 1,
  },
  {
    handle: "HAW",
    displayName: "Hawaii County",
    displayNameShort: "Hawaii County",
    fips: "15001",
    geotype: "county",
    listOrder: 2,
  },
  {
    handle: "KAU",
    displayName: "Kauai County",
    displayNameShort: "Kauai County",
    fips: "15007",
    geotype: "county",
    listOrder: 3,
  },
  {
    handle: "MAU",
    displayName: "Maui County",
    displayNameShort: "Maui County",
    fips: "15009",
    geotype: "county",
    listOrder: 4,
  },
  {
    handle: "OAHU",
    displayName: "Oahu",
    displayNameShort: "Oahu",
    fips: null,
    geotype: "island",
    listOrder: 5,
  },
  {
    handle: "HAWI",
    displayName: "Hawaii Island",
    displayNameShort: "Hawaii Island",
    fips: null,
    geotype: "island",
    listOrder: 6,
  },
  {
    handle: "MAUI",
    displayName: "Maui Island",
    displayNameShort: "Maui Island",
    fips: null,
    geotype: "island",
    listOrder: 7,
  },
  {
    handle: "MOL",
    displayName: "Molokai Island",
    displayNameShort: "Molokai Island",
    fips: null,
    geotype: "island",
    listOrder: 8,
  },
  {
    handle: "LAN",
    displayName: "Lanai Island",
    displayNameShort: "Lanai Island",
    fips: null,
    geotype: "island",
    listOrder: 9,
  },
  {
    handle: "KAUI",
    displayName: "Kauai Island",
    displayNameShort: "Kauai Island",
    fips: null,
    geotype: "island",
    listOrder: 10,
  },
  {
    handle: "NII",
    displayName: "Niihau",
    displayNameShort: "Niihau",
    fips: null,
    geotype: "island",
    listOrder: 11,
  },
  {
    handle: "KAHO",
    displayName: "Kahoolawe",
    displayNameShort: "Kahoolawe",
    fips: null,
    geotype: "island",
    listOrder: 12,
  },
  {
    handle: "US",
    displayName: "United States of America",
    displayNameShort: "USA",
    fips: null,
    geotype: "nation",
    listOrder: 13,
  },
];

/** Label key (see `labelKey`) → handle. County-level labels. */
const COUNTY_LABELS: Record<string, string> = {
  "state total": "HI",
  state: "HI",
  "state of hawaii": "HI",
  statewide: "HI",
  "hawaii state": "HI",
  "hawaii state total": "HI",
  "all counties": "HI",
  "city and county of honolulu": "HON",
  "honolulu county": "HON",
  "city county of honolulu": "HON",
  "c and c of honolulu": "HON",
  honolulu: "HON",
  "hawaii county": "HAW",
  "county of hawaii": "HAW",
  "kauai county": "KAU",
  "county of kauai": "KAU",
  kauai: "KAU",
  "maui county": "MAU",
  "county of maui": "MAU",
  "maui county including kalawao": "MAU",
  "maui and kalawao counties": "MAU",
  "maui and kalawao": "MAU",
  "united states": "US",
  "u s": "US",
  us: "US",
  "us total": "US",
  "united states total": "US",
};

/**
 * Island-level labels. Only used when a table's geography axis is islands
 * (several island names present), because "Hawaii" and "Maui" mean the
 * county in county tables but the island in island tables.
 */
const ISLAND_LABELS: Record<string, string> = {
  "state of hawaii": "HI",
  "state total": "HI",
  hawaii: "HAW",
  "hawaii island": "HAW",
  "big island": "HAW",
  oahu: "HON",
  maui: "MAUI",
  "maui island": "MAUI",
  molokai: "MOL",
  lanai: "LAN",
  kauai: "KAU",
};

const ISLAND_ONLY = new Set(["oahu", "molokai", "lanai", "maui island"]);

/**
 * Map a set of axis labels (all column headers, or all row labels of one
 * level) to geography handles. Returns null unless the axis looks like a
 * geography axis: ≥2 labels map, and they map to distinct handles.
 */
export function geoAxis(labels: string[]): Map<string, string> | null {
  const keys = labels.map(labelKey);
  const island = keys.some((k) => ISLAND_ONLY.has(k));
  const table = island ? ISLAND_LABELS : COUNTY_LABELS;
  const out = new Map<string, string>();
  const seen = new Set<string>();
  for (let i = 0; i < labels.length; i++) {
    const handle =
      table[keys[i]] ?? (island ? COUNTY_LABELS[keys[i]] : undefined);
    if (handle && !seen.has(handle)) {
      out.set(labels[i], handle);
      seen.add(handle);
    }
  }
  return out.size >= 2 ? out : null;
}

/** Single-label lookup at county level (no island ambiguity). */
export function geoHandle(label: string): string | null {
  return COUNTY_LABELS[labelKey(label)] ?? null;
}
