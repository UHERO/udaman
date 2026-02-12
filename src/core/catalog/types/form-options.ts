/** Serialized model shapes for passing across RSC → client boundary. */

export interface GeographyOption {
  id: number;
  universe: string;
  handle: string | null;
  displayName: string | null;
  displayNameShort: string | null;
  fips: string | null;
  listOrder: number | null;
  geotype: string | null;
}

export interface UnitOption {
  id: number;
  universe: string;
  shortLabel: string | null;
  longLabel: string | null;
}

export interface SourceOption {
  id: number;
  universe: string;
  description: string | null;
  link: string | null;
}

export interface SourceDetailOption {
  id: number;
  universe: string;
  description: string | null;
}

export interface SeriesFormOptions {
  geographies: GeographyOption[];
  units: UnitOption[];
  sources: SourceOption[];
  sourceDetails: SourceDetailOption[];
}
