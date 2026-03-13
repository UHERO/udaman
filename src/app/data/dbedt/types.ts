export type CategoryType = {
  id: number;
  name: string;
  universe: string;
  parentId: number;
  children: CategoryType[];
  label?: string;
  key?: number;
  leaf?: boolean;
  expanded?: boolean;
};

export type Freq = {
  freq: string;
  label: string;
  observationStart: string;
  observationEnd: string;
};

export type SelectedFreq = {
  id: string;
  label?: string;
  text?: string;
  state?: boolean;
};

export type SelectedGeo = {
  id: string;
  text?: string;
  state?: boolean;
};

export type Geography = {
  fips?: string;
  handle: string;
  name: string;
  shortName: string;
};

export type Geo = {
  fips: string;
  handle: string;
  name: string;
  shortName: string;
  observationStart: string;
  observationEnd: string;
};

export type TransformationResults = {
  dates: string[];
  pseudoHistory: boolean[];
  transformation: string;
  values: string[];
};

export type SeriesObservations = {
  observationEnd: string;
  observationStart: string;
  orderBy?: string;
  sortOrder?: string;
  transformationResults: TransformationResults[];
};

export type Series = {
  [key: string]: unknown;
  Indicator?: string;
  Area?: string;
  Units?: string;
  decimals: number;
  description: string;
  freqs: Freq[];
  frequency: string;
  frequencyShort: string;
  geography: Geography;
  geos: Geo[];
  id: number;
  measurementId: number;
  measurementName: string;
  name: string;
  percent: boolean;
  observations: Record<string, string>;
  seriesObservations: SeriesObservations;
  sourceDescription: string;
  source_description: string;
  state?: boolean;
  title: string;
  unitsLabel: string;
  unitsLabelShort: string;
  universe: string;
};

export type SubOption = {
  id: number;
  name: string;
  state: boolean;
};

export type DateOptions =
  | "startYear"
  | "startMonth"
  | "startQuarter"
  | "endYear"
  | "endMonth"
  | "endQuarter";
