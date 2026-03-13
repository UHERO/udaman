export interface HhdbListParams {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface HhdbListResult<T> {
  rows: T[];
  total: number;
}

export const ISLAND_NAMES: Record<string, string> = {
  "1": "Hawaii",
  "2": "Maui",
  "3": "Oahu",
  "4": "Kauai",
  "5": "Molokai",
  "6": "Lanai",
};

export type SummaryViewType = "summary";

export interface FieldDef {
  column: string;
  label: string;
  type: SummaryViewType;
  format?: "dollar" | "number" | "year" | "text";
  /** When true, the field is shown but not selectable (e.g. too many unique values). */
  disabled?: boolean;
  disabledReason?: string;
}

/** Per-island counts keyed by first digit of TMK: 1=Oahu, 2=Maui, 3=Hawaii, 4=Kauai */
export type IslandCounts = Record<string, number>;

export interface FreqRow {
  value: string;
  /** county_code → frequency: 0=Statewide, 1=Oahu, 2=Maui, 3=Hawaii, 4=Kauai */
  counts: Record<string, number>;
}

export interface FreqSummaryParams {
  page: number;
  limit: number;
  sortCol: string; // county_code to sort by: "0"=State, "1"=Oahu, etc.
  sortDir: "asc" | "desc";
  search?: string;
}

export interface FreqSummaryResult {
  rows: FreqRow[];
  total: number;
  nullRow: FreqRow | null;
  /** Total record count per county (null + non-null) for percentage calculation */
  totalCounts: Record<string, number>;
  generatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Profile types
// ---------------------------------------------------------------------------

export type FieldCategory =
  | "identifier"
  | "low-cardinality"
  | "high-cardinality"
  | "large-dollar"
  | "small-dollar"
  | "year"
  | "area"
  | "count"
  | "date"
  | "blob";

export type CountyName = "Honolulu" | "Maui" | "Hawaii" | "Kauai";
export type CountyCounts = Record<CountyName, number>;

export const COUNTY_NAMES: CountyName[] = [
  "Honolulu",
  "Maui",
  "Hawaii",
  "Kauai",
];

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  columnType: string;
  isNullable: boolean;
  ordinalPosition: number;
}

export interface OverviewRow {
  columnName: string;
  fieldCategory: FieldCategory;
  dataType: string;
  label: string;
  nonNullCount: number;
  nullCount: number;
  nullPercent: number;
  distinctCount: number;
  totalRows: number;
  countyNonNull?: CountyCounts;
}

export interface OverviewData {
  rows: OverviewRow[];
  totalRows: number;
  countyTotals?: CountyCounts;
}

export interface CategoricalFieldSummary {
  columnName: string;
  label: string;
  distinctCount: number;
  topValues: { value: string; count: number; percent: number }[];
}

export interface CategoricalDrilldown {
  columnName: string;
  label: string;
  totalNonNull: number;
  totalNull: number;
  distinctCount: number;
  mode: string;
  values: {
    value: string;
    count: number;
    percent: number;
    cumulative: number;
  }[];
}

export interface NumericFieldSummary {
  columnName: string;
  label: string;
  fieldCategory: FieldCategory;
  min: number;
  max: number;
  median: number;
  nullCount: number;
  nonNullCount: number;
}

export interface NumericDrilldown {
  columnName: string;
  label: string;
  fieldCategory: FieldCategory;
  min: number;
  max: number;
  median: number;
  nullCount: number;
  nonNullCount: number;
  avg: number;
  zeroCount: number;
  negativeCount: number;
  histogram: { label: string; min: number; max: number; count: number }[];
}

export interface TextFieldSummary {
  columnName: string;
  label: string;
  fieldCategory: FieldCategory;
  totalCount: number;
  distinctCount: number;
  duplicateCount: number;
  nullCount: number;
  nullPercent: number;
  avgLength: number;
}

export interface TextDrilldown {
  columnName: string;
  label: string;
  fieldCategory: FieldCategory;
  totalCount: number;
  distinctCount: number;
  duplicateCount: number;
  nullCount: number;
  nullPercent: number;
  avgLength: number;
  minLength: number;
  maxLength: number;
  topValues: { value: string; count: number }[];
  lengthDistribution: { length: number; count: number }[];
  formatConformance?: {
    pattern: string;
    matchCount: number;
    totalCount: number;
  };
}

export interface TemporalFieldSummary {
  columnName: string;
  label: string;
  minDate: string;
  maxDate: string;
  nullCount: number;
  yearCounts: { year: number; count: number }[];
}

export interface TemporalDrilldown {
  columnName: string;
  label: string;
  minDate: string;
  maxDate: string;
  nullCount: number;
  yearCounts: { year: number; count: number }[];
  monthlyCounts?: { month: number; count: number }[];
  gaps: number[];
}
