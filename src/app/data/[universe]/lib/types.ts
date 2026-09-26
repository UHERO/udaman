/**
 * Types for the public data portal (/data/[universe]).
 *
 * Ported from tmp/data-portal/projects/shared/models/* and tightened against
 * real REST API responses (api.uhero.hawaii.edu/v1, checked 2026-09-25).
 *
 * Conventions that differ from the Angular models:
 *   - Observation values arrive as STRINGS ("368.50"); convert with `+v`.
 *   - `fips` is a string (and absent for islands / aggregates).
 *   - Many series fields are optional: FC (forecast) series omit
 *     seasonalAdjustment/percent/real/source*, NTA series carry
 *     tablePrefix/tablePostfix, etc.
 */

// ─── Primitives ─────────────────────────────────────────────────────

/** Frequency codes used by the API and in URL params (`freq=Q`). */
export type FreqCode = "A" | "S" | "Q" | "M" | "W" | "D";

/** Order from highest to lowest frequency (used by the analyzer). */
export const FREQ_ORDER: FreqCode[] = ["D", "W", "M", "Q", "S", "A"];

export type SeasonalAdjustment =
  "seasonally_adjusted" | "not_seasonally_adjusted" | "not_applicable";

/** Transformation codes as returned in `transformationResults`. */
export type TransformationCode = "lvl" | "pc1" | "ytd" | "c5ma" | "mom";

/** Portal-facing transformation keys (pc1 → yoy, lvl → level). */
export type TransformationKey = "level" | "yoy" | "ytd" | "c5ma" | "mom";

/** Display names the Angular app used for chart transformations. */
export type TransformationDisplayName =
  "Level" | "YOY" | "YTD" | "Annual Change" | "MOM";

// ─── API shapes ─────────────────────────────────────────────────────

export interface Geography {
  fips?: string;
  name: string;
  shortName: string;
  handle: string;
  /** Present on `series.geos[]` entries. ISO-ish w/ HST offset. */
  observationStart?: string;
  observationEnd?: string;
}

export interface Frequency {
  freq: FreqCode;
  label: string;
  /** Present on `series.freqs[]` entries. */
  observationStart?: string;
  observationEnd?: string;
}

/** Forecast option (FC universe only). */
export interface ForecastOption {
  forecast: string; // e.g. "26Q1FF"
  freq: FreqCode;
  label: string;
}

/** One row of GET /category?u=... (flat list). */
export interface ApiCategory {
  id: number;
  name: string;
  universe: string;
  parentId?: number | null;
  defaults?: {
    geo?: Geography;
    freq?: Frequency;
    /** Forecast default (FC universe); may be absent. */
    fc?: string;
    observationStart?: string;
    observationEnd?: string;
  };
}

/** Category with children attached (see buildCategoryTree). */
export interface CategoryNode extends ApiCategory {
  children?: CategoryNode[];
}

export interface PortalCategories {
  /** Top-level categories shown in the sidebar (root's children). */
  tree: CategoryNode[];
  /** Root category id (derived or overridden), null if unknown. */
  rootId: number | null;
  /** The flat list as returned by the API. */
  flat: ApiCategory[];
}

export interface TransformationResult {
  transformation: TransformationCode;
  /** Absent when the series has no data. */
  dates?: string[];
  /** Numeric strings. Absent when the series has no data. */
  values?: string[];
  pseudoHistory?: boolean[];
}

export interface SeriesObservations {
  /** "YYYY-MM-DD" — "1-01-01" when the series has no data. */
  observationStart: string;
  observationEnd: string;
  orderBy: string;
  sortOrder: string;
  transformationResults: TransformationResult[];
}

/** Series metadata (no observations). */
export interface PortalSeries {
  id: number;
  name: string;
  universe: string;
  title: string;
  description?: string;
  measurementId?: number;
  measurementName?: string;
  frequency: string;
  frequencyShort: FreqCode;
  seasonalAdjustment?: SeasonalAdjustment | null;
  seasonallyAdjusted?: boolean;
  unitsLabel?: string;
  unitsLabelShort?: string;
  geography: Geography;
  percent?: boolean;
  real?: boolean;
  decimals?: number;
  sourceDescription?: string;
  sourceLink?: string;
  sourceDetails?: string;
  geos?: Geography[];
  freqs?: Frequency[];
  /** NTA only (usually null). Used in category table row labels. */
  tablePrefix?: string | null;
  tablePostfix?: string | null;
}

/** Series with observations inlined (`expand=true` endpoints). */
export interface ExpandedSeries extends PortalSeries {
  seriesObservations: SeriesObservations;
}

/** GET /package/series */
export interface SeriesPackage {
  series: PortalSeries;
  categories: ApiCategory[];
  observations: SeriesObservations;
  siblings: PortalSeries[];
  /** FC universe only; absent elsewhere. */
  forecasts?: ForecastOption[] | null;
}

/** GET /package/analyzer and /package/analyzermom */
export interface AnalyzerPackage {
  categories: ApiCategory[];
  series: ExpandedSeries[];
}

/** GET /search — summary of what a search term matches. */
export interface SearchSummary {
  q: string;
  defaultGeo: Geography;
  defaultFreq: Frequency;
  geos: Geography[];
  freqs: Frequency[];
  observationStart: string;
  observationEnd: string;
}

/** GET /package/search */
export interface PackageSearch extends SearchSummary {
  series: ExpandedSeries[];
}

/** GET /category/measurements (NTA). `indent` marks sub-rows. */
export interface Measurement {
  id: number;
  name: string;
  indent?: number;
}

// ─── Derived / shaping types ───────────────────────────────────────

/** One period on a frequency grid. */
export interface DateEntry {
  /** "YYYY-MM-DD" */
  date: string;
  /** Table header label: "2020", "2020 Q1", "2020-01", "2020-01-15". */
  tableDate: string;
}

/** Selected date range (DateRange model). */
export interface DateRange {
  startDate: string;
  endDate: string;
  /** True when no explicit start/end — URL params should be omitted. */
  useDefaultRange: boolean;
  /** True when endDate is the last available date — omit `end` from URL. */
  endOfSample: boolean;
}

/** Earliest start / latest end across a set of series (DateWrapper model). */
export interface DateWrapper {
  firstDate: string;
  endDate: string;
}

/** Per-frequency default display range (Angular `defaultRange` provider). */
export interface DefaultRange {
  freq: FreqCode;
  /** Number of years to show by default. */
  range: number;
  /** Optional fixed start/end YEAR ("2000"), NTA uses these. */
  start?: string;
  end?: string;
}

/** Transformations picked out of transformationResults by key. */
export type TransformationSet = Partial<
  Record<TransformationKey, TransformationResult>
>;

/** A row for recharts: one period with numeric values per transformation. */
export interface SeriesChartRow {
  date: string;
  /** Date.parse(date) — UTC ms, handy for numeric x-axes. */
  ts: number;
  level: number | null;
  yoy: number | null;
  ytd: number | null;
  c5ma: number | null;
  mom: number | null;
}

/** Pseudo-history boundary: level values before `date` are pseudo history. */
export interface PseudoZone {
  /** Last date that is pseudo-history. */
  date: string;
  ts: number;
}

/** Row of the single-series table (helper.createSeriesTable). */
export interface SeriesTableRow {
  date: string;
  tableDate: string;
  value: number | null;
  formattedValue: string;
  yoyValue: number | null;
  formattedYoy: string;
  ytdValue: number | null;
  formattedYtd: string;
  c5maValue: number | null;
  formattedC5ma: string;
}

/** Summary statistics (series-helper.calculateSeriesSummaryStats). */
export interface SummaryStats {
  range: string;
  minValue: string;
  maxValue: string;
  /** null when the series is a percent (change is not meaningful). */
  percChange: string | null;
  levelChange: string;
  total: string;
  avg: string;
  cagr: string;
  /** True if the range start/end fall outside the series' data. */
  missing: boolean;
}

/** Series grouped by measurement, in API order. */
export interface MeasurementGroup<S extends PortalSeries = ExpandedSeries> {
  measurementName: string;
  series: S[];
}
