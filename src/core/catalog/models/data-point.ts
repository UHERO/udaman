export type DataPointAttrs = {
  xseries_id: number;
  date: Date;
  created_at: Date;
  data_source_id: number;
  current?: boolean | null;
  value?: number | null;
  pseudo_history?: number | null;
  updated_at?: Date | null;
};

class DataPoint {
  readonly xseriesId: number;
  readonly date: Date;
  readonly createdAt: Date;
  readonly dataSourceId: number;
  current: boolean;
  value: number | null;
  pseudoHistory: boolean;
  updatedAt: Date | null;

  constructor(attrs: DataPointAttrs) {
    this.xseriesId = attrs.xseries_id;
    this.date = new Date(attrs.date);
    this.createdAt = new Date(attrs.created_at);
    this.dataSourceId = attrs.data_source_id;
    this.current = !!attrs.current;
    this.value = attrs.value ?? null;
    this.pseudoHistory = !!(attrs.pseudo_history && attrs.pseudo_history !== 0);
    this.updatedAt = attrs.updated_at ? new Date(attrs.updated_at) : null;
  }

  toJSON() {
    return {
      xseriesId: this.xseriesId,
      date: this.date,
      createdAt: this.createdAt,
      dataSourceId: this.dataSourceId,
      current: this.current,
      value: this.value,
      pseudoHistory: this.pseudoHistory,
      updatedAt: this.updatedAt,
    };
  }

  toString() {
    return `DataPoint(xs=${this.xseriesId}, date=${this.date.toISOString()}, value=${this.value})`;
  }
}

export default DataPoint;
