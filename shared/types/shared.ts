import type {
  data_points,
  data_sources,
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

export type Universe = "UHERO" | "DBEDT" | "NTA" | "COH" | "CCOM";

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

export type DataLoader = Pick<
  data_sources,
  | "id"
  | "series_id"
  | "disabled"
  | "universe"
  | "priority"
  | "created_at"
  | "updated_at"
  | "reload_nightly"
  | "pseudo_history"
  | "clear_before_load"
  | "eval"
  | "scale"
  | "presave_hook"
  | "color"
  | "runtime"
  | "last_run_at"
  | "last_run_in_seconds"
  | "last_error"
  | "last_error_at"
  | "dependencies"
  | "description"
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

export type DataPoint = DataPointsSelection & CalculatedFields;

export type DataLoaderType = Pick<
  data_sources,
  | "id"
  | "description"
  | "last_run_in_seconds"
  | "priority"
  | "disabled"
  | "eval"
  | "dependencies"
>;

export interface SeriesDependency {
  name: string;
  id: number;
  aremos_missing: number | null;
  aremos_diff: number | null;
}

export interface SourceMapNode {
  dataSource: DataLoaderType;
  dependencies: SeriesDependency[];
  children: SourceMapNode[];
  depth: number;
  color: string;
}
