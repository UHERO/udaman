export interface DataPoint {
    xseries_id: number;
    date: string;
    created_at: Date;
    data_source_id: number;
    current: 0 | 1;
    value: number;
    pseudo_history: number;
    history: Date;
    updated_at: Date;
    change: number;
    yoy: number;
    ytd: number;
}
//# sourceMappingURL=data-points.d.ts.map