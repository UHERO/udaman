export interface DataPoint {
    xseries_id: number;
    date: Date;
    created_at: Date;
    data_source_id: number;
    current: 0 | 1 | null;
    value: number | null;
    pseudo_history: number;
    history: Date | null;
    updated_at: Date | null;
    change: number | null;
    yoy: number | null;
    ytd: number | null;
}
//# sourceMappingURL=data-points.d.ts.map