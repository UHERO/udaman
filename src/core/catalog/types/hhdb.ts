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
