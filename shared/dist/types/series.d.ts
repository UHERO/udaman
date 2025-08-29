import { SeasonalAdjustment } from "./shared";
export interface Series {
    id: number;
    xseries_id: number;
    geography_id: number;
    unit_id: number;
    source_id: number;
    source_detail_id: number | null;
    universe: string;
    decimals: number;
    name: string;
    dataPortalName: string;
    description: string | null;
    created_at: Date;
    updated_at: Date;
    dependency_depth: number;
    source_link: string | null;
    investigation_notes: string | null;
    scratch: number;
}
export interface XSeries {
    id: number;
    primary_series_id: number;
    restricted: number;
    quarantined: number;
    frequency: string;
    seasonally_adjusted: null;
    seasonal_adjustment: SeasonalAdjustment;
    aremos_missing: number;
    aremos_diff: null;
    mult: null;
    created_at: Date;
    updated_at: Date;
    units: number;
    percent: number;
    real: number;
    base_year: null;
    frequency_transform: string;
    last_demetra_date: null;
    last_demetra_datestring: null;
    factor_application: null;
    factors: null;
}
export interface SeriesSummary {
    name: string;
    seasonalAdjustment: SeasonalAdjustment;
    portalName: string;
    unitShortLabel: string;
    minDate: Date | null;
    maxDate: Date | null;
    sourceDescription: string;
    sourceUrl: string;
}
//# sourceMappingURL=series.d.ts.map