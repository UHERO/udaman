import { source_details, sources, type data_sources, type geographies, type series, type units, type xseries } from "@prisma/client";
type PrefixKeys<T, P extends string> = {
    [K in keyof T as `${P}${string & K}`]: T[K];
};
type SeriesSelection = Pick<series, "id" | "geography_id" | "unit_id" | "source_id" | "source_detail_id" | "universe" | "decimals" | "name" | "dataPortalName" | "description" | "created_at" | "updated_at" | "dependency_depth" | "source_link" | "investigation_notes" | "scratch">;
type XseriesSelection = Pick<xseries, "id" | "primary_series_id" | "restricted" | "quarantined" | "frequency" | "seasonally_adjusted" | "seasonal_adjustment" | "aremos_missing" | "aremos_diff" | "mult" | "created_at" | "updated_at" | "units" | "percent" | "real" | "base_year" | "frequency_transform" | "last_demetra_date" | "last_demetra_datestring" | "factor_application" | "factors">;
type DataSourceSelection = Pick<data_sources, "id" | "series_id" | "disabled" | "universe" | "priority" | "created_at" | "updated_at" | "reload_nightly" | "pseudo_history" | "clear_before_load" | "eval" | "scale" | "presave_hook" | "color" | "runtime" | "last_run_at" | "last_run_in_seconds" | "last_error" | "last_error_at" | "dependencies" | "description">;
type GeoSelection = Pick<geographies, "handle" | "display_name">;
type SourceSelection = Pick<sources, "description" | "link">;
type SourceDetailSelection = Pick<source_details, "description">;
type UnitsDetailSelection = Pick<units, "long_label" | "short_label">;
export type SeriesMetadata = PrefixKeys<SeriesSelection, "s_"> & PrefixKeys<XseriesSelection, "xs_"> & PrefixKeys<DataSourceSelection, "ds_"> & PrefixKeys<GeoSelection, "geo_"> & PrefixKeys<SourceSelection, "source"> & PrefixKeys<SourceDetailSelection, "source_detail_"> & PrefixKeys<UnitsDetailSelection, "u_">;
export {};
//# sourceMappingURL=series-metadata.d.ts.map