import type {
  data_points,
  geographies,
  series,
  source_details,
  sources,
  units,
  xseries,
} from "@prisma/client";

export type SeasonalAdjustment =
  | "not_seasonally_adjusted"
  | "seasonally_adjusted"
  | "not_applicable";

export type Universe = "UHERO" | "FC" | "DBEDT" | "NTA" | "COH" | "CCOM";
export type Frequency = "A" | "S" | "Q" | "M" | "W" | "D";

export interface Category {
  id: number;
  dataListId: number | null;
  defaultGeoId: number | null;
  universe: Universe;
  hidden: boolean;
  masked: boolean;
  header: boolean;
  listOrder: number | null;
  name: string | null;
  ancestry: string | null;
  defaultHandle: string | null;
  defaultFreq: Frequency | null;
  meta: string | null;
  description: string | null;
}

export type CreateCategoryPayload = {
  parentId?: number | null;
  name?: string | null;
  description?: string | null;
  dataListId?: number | null;
  defaultGeoId?: number | null;
  defaultFreq?: Frequency | null;
  universe?: Universe;
  header?: boolean;
  masked?: boolean;
  hidden?: boolean;
};

export type UpdateCategoryPayload = Partial<
  Omit<CreateCategoryPayload, "parentId">
> & {
  listOrder?: number | null;
  meta?: string | null;
};

export type Geography = {
  id: number;
  universe: Universe;
  handle: string | null;
  displayName: string | null;
  displayNameShort: string | null;
  fips: string | null;
  listOrder: number | null;
  geotype: string | null;
};

// Helper type to add prefix to keys
type PrefixKeys<T, P extends string> = {
  [K in keyof T as `${P}${string & K}`]: T[K];
};

// The following is an approach for typing the results from the monster
// query for getting series metadata b/c fields are all renamed and
// returned in a flat object.
type SeriesSelection = Pick<
  series,
  | "id"
  | "geography_id"
  | "unit_id"
  | "source_id"
  | "source_detail_id"
  | "universe"
  | "decimals"
  | "name"
  | "dataPortalName"
  | "description"
  | "created_at"
  | "updated_at"
  | "dependency_depth"
  | "source_link"
  | "investigation_notes"
  | "scratch"
>;

type XseriesSelection = Pick<
  xseries,
  | "id"
  | "primary_series_id"
  | "restricted"
  | "quarantined"
  | "frequency"
  | "seasonally_adjusted"
  | "seasonal_adjustment"
  | "aremos_missing"
  | "aremos_diff"
  | "mult"
  | "created_at"
  | "updated_at"
  | "units"
  | "percent"
  | "real"
  | "base_year"
  | "frequency_transform"
  | "last_demetra_date"
  | "last_demetra_datestring"
  | "factor_application"
  | "factors"
>;

type GeoSelection = Pick<geographies, "handle" | "display_name">;
type SourceSelection = Pick<sources, "description" | "link">;
type SourceDetailSelection = Pick<source_details, "description">;
type UnitsDetailSelection = Pick<units, "long_label" | "short_label">;

export type SeriesMetadata = PrefixKeys<SeriesSelection, "s_"> &
  PrefixKeys<XseriesSelection, "xs_"> &
  PrefixKeys<GeoSelection, "geo_"> &
  PrefixKeys<SourceSelection, "source_"> &
  PrefixKeys<SourceDetailSelection, "source_detail_"> &
  PrefixKeys<UnitsDetailSelection, "u_">;

/** Minimal alias shape used by the series detail page (from Series.toJSON()). */
export interface SeriesAlias {
  id: number | null;
  name: string;
}

/** Minimal measurement shape used by the series detail page. */
export interface MeasurementRef {
  id: number;
  prefix: string;
}

type DataPointsSelection = Pick<
  data_points,
  "date" | "value" | "updated_at" | "pseudo_history"
>;

type CalculatedFields = {
  yoy: number | null;
  ytd: number | null;
  lvl_change: number | null;
  color: string;
};

export type DataPoint = DataPointsSelection &
  CalculatedFields & { loader_id: number };

export interface SourceMapDataSource {
  id: number;
  series_id: number;
  disabled: boolean;
  universe: Universe;
  color: string;
  last_run_at: Date | null;
  last_run_in_seconds: number | null;
  last_error: string | null;
  dependencies: string | null;
  description: string | null;
  aremos_missing: number | null;
  aremos_diff: number | null;
}

export interface SourceMapNode {
  name: string;
  children: SourceMapNode[];
  level: number;
  dataSource: SourceMapDataSource;
}

export interface SeriesDependency {
  name: string;
  id: number;
  aremos_missing: number | null;
  aremos_diff: number | null;
}

export interface SeriesAuditRow {
  id: number;
  name: string;
  dataPortalName: string | null;
  loaderEvals: string[];
}

// ─── Analyze / Transform ─────────────────────────────────────────────

export interface AnalyzeSeriesData {
  id: number | null;
  name: string;
  dataPortalName: string | null;
  universe: Universe;
  frequency: string | null;
  frequencyCode: string | null;
  decimals: number;
  observationCount: number;
  data: [string, number][];
}

export interface AnalyzeResult {
  series: AnalyzeSeriesData;
  yoy: [string, number][];
  levelChange: [string, number][];
  ytd: [string, number][];
  stats?: { mean: number; median: number | null; standardDeviation: number };
  siblings?: Array<{ freqCode: string; id: number; name: string }>;
  seriesLinks?: Record<string, number>;
  seriesLastValues?: Record<string, number>;
  resultValue?: number | null;
  unitLabel?: string | null;
}
