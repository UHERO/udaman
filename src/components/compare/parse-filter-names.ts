import type { FilterRow } from "@catalog/controllers/compare-filters";

export type FilterRowState = FilterRow;

export type OptionsCache = Record<
  string,
  {
    measurements: {
      id: number;
      prefix: string;
      dataPortalName: string | null;
    }[];
    geos: { handle: string; displayName: string | null }[];
  }
>;

/** Cache of measurementId → available frequency codes */
export type FreqCache = Record<number, string[]>;

export type GeoFreqOptions = {
  geos: string[];
  frequencies: string[];
  combinations: { geo: string; freq: string }[];
};

/** Geo+freq combinations for a given prefix, keyed by "prefix|universe". */
export type PrefixOptionsCache = Record<string, GeoFreqOptions>;

/** Geo+freq combinations for a measurement, keyed by measurementId. */
export type MeasurementOptionsCache = Record<number, GeoFreqOptions>;

const NAME_RE = /^(.+?)@(\w+)\.([ASQMWD])$/i;

export function parseSeriesName(name: string) {
  const m = name.match(NAME_RE);
  if (!m) return null;
  return { prefix: m[1], geo: m[2].toUpperCase(), freq: m[3].toUpperCase() };
}

/** Reconstruct filter rows from a list of series names (e.g. from URL). */
export function buildRowsFromNames(
  names: string[],
  universe: string,
  defaultFreq: string,
): FilterRowState[] {
  const groups = new Map<string, { geos: Set<string>; freq: string }>();
  for (const name of names) {
    const parsed = parseSeriesName(name);
    if (!parsed) continue;
    const key = `${parsed.prefix}|${parsed.freq}`;
    const existing = groups.get(key);
    if (existing) {
      existing.geos.add(parsed.geo);
    } else {
      groups.set(key, { geos: new Set([parsed.geo]), freq: parsed.freq });
    }
  }
  if (groups.size === 0) return [makeEmptyRow(universe, defaultFreq)];
  return [...groups.entries()].map(([key, { geos, freq }]) => ({
    id: crypto.randomUUID(),
    prefix: key.split("|")[0],
    mode: "search" as const,
    measurementId: null,
    geos: [...geos],
    frequency: freq,
    adjustment: "na" as const,
    universe,
  }));
}

export function makeEmptyRow(
  universe: string,
  frequency: string,
): FilterRowState {
  return {
    id: crypto.randomUUID(),
    prefix: "",
    mode: "search",
    measurementId: null,
    geos: [],
    frequency,
    adjustment: "na",
    universe,
  };
}

export const ALL_FREQUENCY_OPTIONS = [
  { value: "A", label: "A" },
  { value: "S", label: "S" },
  { value: "Q", label: "Q" },
  { value: "M", label: "M" },
  { value: "W", label: "W" },
  { value: "D", label: "D" },
];

export const ADJUSTMENT_OPTIONS = [
  { value: "na", label: "NA" },
  { value: "ns", label: "NS" },
  { value: "sa", label: "SA" },
];

export const UNIVERSES = [
  "UHERO",
  "DBEDT",
  "FC",
  "NTA",
  "COH",
  "CCOM",
] as const;

/** Imperative handle exposed by each builder via forwardRef. */
export interface BuilderHandle {
  submit: () => Promise<void>;
}
