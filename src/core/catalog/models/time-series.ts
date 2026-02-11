import type { SeasonalAdjustment } from "../types/shared";

// ─── Input type ──────────────────────────────────────────────────────
// Matches the `xseries` DB table columns 1:1 (snake_case).

export type TimeSeriesAttrs = {
  id: number;
  primary_series_id?: number | null;
  restricted?: boolean | number | null;
  quarantined?: boolean | number | null;
  frequency?: string | null;
  seasonally_adjusted?: boolean | number | null;
  seasonal_adjustment?: string | null;
  aremos_missing?: number | null;
  aremos_diff?: number | null;
  mult?: number | null;
  units?: number | null;
  percent?: boolean | number | null;
  real?: boolean | number | null;
  base_year?: number | null;
  frequency_transform?: string | null;
  last_demetra_date?: Date | string | null;
  last_demetra_datestring?: string | null;
  factor_application?: string | null;
  factors?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

// ─── Model ───────────────────────────────────────────────────────────

class TimeSeries {
  readonly id: number;
  primarySeriesId: number | null;
  restricted: boolean;
  quarantined: boolean;
  frequency: string | null;
  seasonallyAdjusted: boolean | null;
  seasonalAdjustment: SeasonalAdjustment | null;
  aremosMissing: number | null;
  aremosDiff: number | null;
  mult: number | null;
  units: number;
  percent: boolean | null;
  real: boolean | null;
  baseYear: number | null;
  frequencyTransform: string | null;
  lastDemetraDate: Date | null;
  lastDemetraDatestring: string | null;
  factorApplication: string | null;
  factors: Record<string, unknown> | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: TimeSeriesAttrs) {
    this.id = attrs.id;
    this.primarySeriesId = attrs.primary_series_id ?? null;
    this.restricted = Boolean(attrs.restricted);
    this.quarantined = Boolean(attrs.quarantined);
    this.frequency = attrs.frequency ?? null;
    this.seasonallyAdjusted =
      attrs.seasonally_adjusted != null ? Boolean(attrs.seasonally_adjusted) : null;
    this.seasonalAdjustment =
      (attrs.seasonal_adjustment as SeasonalAdjustment) ?? null;
    this.aremosMissing = attrs.aremos_missing ?? null;
    this.aremosDiff = attrs.aremos_diff ?? null;
    this.mult = attrs.mult ?? null;
    this.units = attrs.units ?? 1;
    this.percent = attrs.percent != null ? Boolean(attrs.percent) : null;
    this.real = attrs.real != null ? Boolean(attrs.real) : null;
    this.baseYear = attrs.base_year ?? null;
    this.frequencyTransform = attrs.frequency_transform ?? null;
    this.lastDemetraDate = attrs.last_demetra_date
      ? new Date(attrs.last_demetra_date as string | Date)
      : null;
    this.lastDemetraDatestring = attrs.last_demetra_datestring ?? null;
    this.factorApplication = attrs.factor_application ?? null;
    this.factors = TimeSeries.parseFactors(attrs.factors);
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  /** Parse the serialized factors column (Rails `serialize :factors, Hash`). */
  private static parseFactors(
    raw: string | null | undefined
  ): Record<string, unknown> | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Whether SA validation rules should be enforced for this frequency. */
  get isAnnual(): boolean {
    return this.frequency === "year";
  }

  // ─── Validation (port of xseries.required_fields) ─────────────────

  validate(opts?: { enforceFields?: boolean }): string[] {
    const errors: string[] = [];
    if (opts?.enforceFields !== false) {
      if (this.percent == null) errors.push("Percent is required");
      if (!this.seasonalAdjustment) errors.push("Seasonal Adjustment is required");
      if (!this.frequencyTransform) errors.push("Frequency Transform is required");
      if (this.restricted == null) errors.push("Restricted is required");
    }
    return errors;
  }

  // ─── Display ──────────────────────────────────────────────────────

  toString(): string {
    return `TimeSeries#${this.id} (${this.frequency ?? "?"}, ${this.seasonalAdjustment ?? "?"})`;
  }

  toJSON() {
    return {
      id: this.id,
      primarySeriesId: this.primarySeriesId,
      restricted: this.restricted,
      quarantined: this.quarantined,
      frequency: this.frequency,
      seasonallyAdjusted: this.seasonallyAdjusted,
      seasonalAdjustment: this.seasonalAdjustment,
      aremosMissing: this.aremosMissing,
      aremosDiff: this.aremosDiff,
      mult: this.mult,
      units: this.units,
      percent: this.percent,
      real: this.real,
      baseYear: this.baseYear,
      frequencyTransform: this.frequencyTransform,
      lastDemetraDate: this.lastDemetraDate?.toISOString() ?? null,
      lastDemetraDatestring: this.lastDemetraDatestring,
      factorApplication: this.factorApplication,
      factors: this.factors,
    };
  }
}

export type SerializedTimeSeries = ReturnType<TimeSeries["toJSON"]>;

export default TimeSeries;
