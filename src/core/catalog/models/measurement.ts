import type { SeasonalAdjustment, Universe } from "../types/shared";

export type MeasurementAttrs = {
  id: number;
  unit_id?: number | null;
  source_id?: number | null;
  source_detail_id?: number | null;
  universe?: string;
  prefix: string;
  data_portal_name?: string | null;
  table_prefix?: string | null;
  table_postfix?: string | null;
  frequency_transform?: string | null;
  percent?: boolean | number | null;
  real?: boolean | number | null;
  decimals?: number | null;
  restricted?: boolean | number | null;
  seasonally_adjusted?: boolean | number | null;
  seasonal_adjustment?: string | null;
  source_link?: string | null;
  notes?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

class Measurement {
  readonly id: number;
  readonly universe: Universe;
  unitId: number | null;
  sourceId: number | null;
  sourceDetailId: number | null;
  prefix: string;
  dataPortalName: string | null;
  tablePrefix: string | null;
  tablePostfix: string | null;
  frequencyTransform: string | null;
  percent: boolean | null;
  real: boolean | null;
  decimals: number;
  restricted: boolean;
  seasonallyAdjusted: boolean | null;
  seasonalAdjustment: SeasonalAdjustment | null;
  sourceLink: string | null;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: MeasurementAttrs) {
    this.id = attrs.id;
    this.universe = (attrs.universe as Universe) ?? "UHERO";
    this.unitId = attrs.unit_id ?? null;
    this.sourceId = attrs.source_id ?? null;
    this.sourceDetailId = attrs.source_detail_id ?? null;
    this.prefix = attrs.prefix;
    this.dataPortalName = attrs.data_portal_name ?? null;
    this.tablePrefix = attrs.table_prefix ?? null;
    this.tablePostfix = attrs.table_postfix ?? null;
    this.frequencyTransform = attrs.frequency_transform ?? null;
    this.percent = attrs.percent != null ? Boolean(attrs.percent) : null;
    this.real = attrs.real != null ? Boolean(attrs.real) : null;
    this.decimals = attrs.decimals ?? 1;
    this.restricted = Boolean(attrs.restricted);
    this.seasonallyAdjusted =
      attrs.seasonally_adjusted != null
        ? Boolean(attrs.seasonally_adjusted)
        : null;
    this.seasonalAdjustment =
      (attrs.seasonal_adjustment as SeasonalAdjustment) ?? null;
    this.sourceLink = attrs.source_link ?? null;
    this.notes = attrs.notes ?? null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  get prefixAndName(): string {
    return `${this.prefix} -> ${this.dataPortalName}`;
  }

  toString(): string {
    return `${this.universe}/${this.prefix}`;
  }

  toJSON() {
    return {
      id: this.id,
      universe: this.universe,
      unitId: this.unitId,
      sourceId: this.sourceId,
      sourceDetailId: this.sourceDetailId,
      prefix: this.prefix,
      dataPortalName: this.dataPortalName,
      frequencyTransform: this.frequencyTransform,
      percent: this.percent,
      real: this.real,
      decimals: this.decimals,
      restricted: this.restricted,
      seasonalAdjustment: this.seasonalAdjustment,
      sourceLink: this.sourceLink,
      notes: this.notes,
    };
  }
}

export default Measurement;
