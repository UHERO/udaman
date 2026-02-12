import type { SeasonalAdjustment, Universe } from "../types/shared";

// ─── Name parsing ────────────────────────────────────────────────────
// Series names follow the pattern: PREFIX@GEO.FREQ
// e.g. "E_NF@HI.M" → prefix=E_NF, geo=HI, freq=M

const NAME_REGEX =
  /^(([%$\w]+?)(&([0-9Q]+)([FH])(\d+|F))?)@(\w+?)(\.([ASQMWD]))?$/i;

export type FrequencyCode = "A" | "S" | "Q" | "M" | "W" | "D";

export type FrequencyLong =
  | "year"
  | "semi"
  | "quarter"
  | "month"
  | "week"
  | "day";

const FREQ_CODE_TO_LONG: Record<FrequencyCode, FrequencyLong> = {
  A: "year",
  S: "semi",
  Q: "quarter",
  M: "month",
  W: "week",
  D: "day",
};

const FREQ_LONG_TO_CODE = Object.fromEntries(
  Object.entries(FREQ_CODE_TO_LONG).map(([k, v]) => [v, k]),
) as Record<FrequencyLong, FrequencyCode>;

/** Apply a single arithmetic operation. Returns null for NaN/Infinity. */
function doArithmetic(a: number, op: string, b: number): number | null {
  let result: number;
  switch (op) {
    case "+":  result = a + b; break;
    case "-":  result = a - b; break;
    case "*":  result = a * b; break;
    case "/":  result = a / b; break;
    case "**": result = a ** b; break;
    default: return null;
  }
  if (!isFinite(result) || isNaN(result)) return null;
  return result;
}

export interface ParsedName {
  prefixFull: string;
  prefix: string;
  forecast: string | null;
  version: string | null;
  history: string | null;
  geo: string;
  freq: FrequencyCode | null;
  freqLong: FrequencyLong | null;
}

// ─── Input type ──────────────────────────────────────────────────────
// What you pass to `new Series(...)` — typically a row from the DB
// or a merged series+xseries object. Uses snake_case to match DB columns.

export type SeriesAttrs = {
  id?: number | null;
  xseries_id?: number | null;
  universe?: string | null;
  name: string;
  dataPortalName?: string | null;
  description?: string | null;
  decimals?: number | null;
  geography_id?: number | null;
  unit_id?: number | null;
  source_id?: number | null;
  source_detail_id?: number | null;
  source_link?: string | null;
  investigation_notes?: string | null;
  dependency_depth?: number | null;
  scratch?: number | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
  // xseries fields
  primary_series_id?: number | null;
  frequency?: string | null;
  restricted?: boolean | number | null;
  quarantined?: boolean | number | null;
  seasonal_adjustment?: string | null;
  seasonally_adjusted?: boolean | number | null;
  aremos_missing?: number | null;
  aremos_diff?: number | null;
  percent?: boolean | number | null;
  real?: boolean | number | null;
};

// ─── Model ───────────────────────────────────────────────────────────

class Series {
  // series table fields
  readonly id: number | null;
  readonly xseriesId: number | null;
  readonly universe: Universe;
  name: string;
  dataPortalName: string | null;
  description: string | null;
  decimals: number;
  geographyId: number | null;
  unitId: number | null;
  sourceId: number | null;
  sourceDetailId: number | null;
  sourceLink: string | null;
  investigationNotes: string | null;
  dependencyDepth: number;
  scratch: number;
  createdAt: Date | null;
  updatedAt: Date | null;

  // xseries fields (delegated, mirrors Rails `delegate_missing_to :xseries`)
  readonly primarySeriesId: number | null;
  frequency: string | null;
  restricted: boolean;
  quarantined: boolean;
  seasonalAdjustment: SeasonalAdjustment | null;
  seasonallyAdjusted: boolean | null;
  aremossMissing: number | null;
  aremosDiff: number | null;
  percent: boolean | null;
  real: boolean | null;

  // in-memory state (not persisted)
  #data: Map<string, number> | null = null;
  #trimStart: Date | null = null;
  #trimEnd: Date | null = null;

  constructor(attrs: SeriesAttrs) {
    // series
    this.id = attrs.id ?? null;
    this.xseriesId = attrs.xseries_id ?? null;
    this.universe = (attrs.universe as Universe) ?? "UHERO";
    this.name = attrs.name;
    this.dataPortalName = attrs.dataPortalName ?? null;
    this.description = attrs.description ?? null;
    this.decimals = attrs.decimals ?? 1;
    this.geographyId = attrs.geography_id ?? null;
    this.unitId = attrs.unit_id ?? null;
    this.sourceId = attrs.source_id ?? null;
    this.sourceDetailId = attrs.source_detail_id ?? null;
    this.sourceLink = attrs.source_link ?? null;
    this.investigationNotes = attrs.investigation_notes ?? null;
    this.dependencyDepth = attrs.dependency_depth ?? 0;
    this.scratch = attrs.scratch ?? 0;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at as string | Date) : null;
    this.updatedAt = attrs.updated_at ? new Date(attrs.updated_at as string | Date) : null;

    // xseries
    this.primarySeriesId = attrs.primary_series_id ?? null;
    this.frequency = attrs.frequency ?? null;
    this.restricted = Boolean(attrs.restricted);
    this.quarantined = Boolean(attrs.quarantined);
    this.seasonalAdjustment = (attrs.seasonal_adjustment as SeasonalAdjustment) ?? null;
    this.seasonallyAdjusted = attrs.seasonally_adjusted != null ? Boolean(attrs.seasonally_adjusted) : null;
    this.aremossMissing = attrs.aremos_missing ?? null;
    this.aremosDiff = attrs.aremos_diff ?? null;
    this.percent = attrs.percent != null ? Boolean(attrs.percent) : null;
    this.real = attrs.real != null ? Boolean(attrs.real) : null;
  }

  // ─── Display ─────────────────────────────────────────────────────

  toString(): string {
    return this.name ?? "UNNAMED_SERIES";
  }

  // ─── Name parsing & building ─────────────────────────────────────

  static parseName(name: string): ParsedName {
    const m = name.match(NAME_REGEX);
    if (!m) throw new SeriesNameError(`Invalid series name format: ${name}`);

    const freqCode = m[9]?.toUpperCase() as FrequencyCode | undefined;
    return {
      prefixFull: m[1],
      prefix: m[2],
      forecast: m[4]?.toUpperCase() ?? null,
      version: m[5]?.toUpperCase() === "F" ? (m[6]?.toUpperCase() ?? null) : null,
      history: m[5]?.toUpperCase() === "H" ? (m[6]?.toUpperCase() ?? null) : null,
      geo: m[7].toUpperCase(),
      freq: freqCode ?? null,
      freqLong: freqCode ? FREQ_CODE_TO_LONG[freqCode] ?? null : null,
    };
  }

  parseName(): ParsedName {
    return Series.parseName(this.name);
  }

  static buildName(prefix: string, geo: string, freq?: string | null): string {
    if (!prefix?.trim() || !geo?.trim()) {
      throw new Error(`Empty prefix ("${prefix}") and/or geography ("${geo}") not allowed`);
    }
    let name = `${prefix.trim().toUpperCase()}@${geo.trim().toUpperCase()}`;
    if (freq) name += `.${freq.trim().toUpperCase()}`;
    Series.parseName(name); // validate
    return name;
  }

  buildName(overrides: Partial<ParsedName> = {}): string {
    const parts = { ...this.parseName(), ...overrides };
    return Series.buildName(parts.prefix, parts.geo, parts.freq);
  }

  get nameNoFreq(): string {
    return this.buildName({ freq: null });
  }

  static isValidName(str: string): boolean {
    return NAME_REGEX.test(str);
  }

  // ─── Frequency helpers ───────────────────────────────────────────

  static frequencyFromCode(code: string | null | undefined): FrequencyLong | null {
    if (!code) return null;
    return FREQ_CODE_TO_LONG[code.toUpperCase() as FrequencyCode] ?? null;
  }

  static codeFromFrequency(freq: string | null | undefined): FrequencyCode | null {
    if (!freq) return null;
    const normalized = freq.toLowerCase().replace(/ly$/, "");
    return FREQ_LONG_TO_CODE[normalized as FrequencyLong] ?? null;
  }

  get frequencyCode(): FrequencyCode | null {
    return Series.codeFromFrequency(this.frequency);
  }

  get frequencyFromName(): FrequencyLong | null {
    return Series.parseName(this.name).freqLong;
  }

  // ─── Identity & relationships ────────────────────────────────────

  get isPrimary(): boolean {
    return this.primarySeriesId === this.id;
  }

  get isAlias(): boolean {
    return !this.isPrimary;
  }

  // ─── Seasonal adjustment ─────────────────────────────────────────

  get isSA(): boolean {
    if (this.seasonalAdjustment === "seasonally_adjusted") return true;
    if (this.seasonalAdjustment === "not_seasonally_adjusted") return false;
    // fuzzy: infer from name suffix
    return /SA$/i.test(this.parseName().prefix);
  }

  get isNS(): boolean {
    if (this.seasonalAdjustment === "not_seasonally_adjusted") return true;
    if (this.seasonalAdjustment === "seasonally_adjusted") return false;
    return /NS$/i.test(this.parseName().prefix);
  }

  get nsSeriesName(): string {
    const prefix = this.parseName().prefix;
    if (/NS$/i.test(prefix)) throw new Error(`${this} already ends in NS`);
    return this.buildName({ prefix: prefix + "NS" });
  }

  get nonNsSeriesName(): string {
    return this.buildName({ prefix: this.parseName().prefix.replace(/NS$/i, "") });
  }

  // ─── Validation ──────────────────────────────────────────────────

  get isValid(): boolean {
    return this.validate().length === 0;
  }

  validate(): string[] {
    const errors: string[] = [];
    if (!this.name) errors.push("Name is required");
    if (this.sourceLink && !Series.#isValidUrl(this.sourceLink)) {
      errors.push("Source link is not a valid URL");
    }
    if (this.universe === "UHERO" && !this.#noEnforceFields) {
      if (!this.dataPortalName) errors.push("Data Portal Name is required");
      if (!this.unitId) errors.push("Unit is required");
      if (!this.sourceId) errors.push("Source is required");
      if (this.decimals == null) errors.push("Decimals is required");
    }
    return errors;
  }

  get #noEnforceFields(): boolean {
    if (this.universe !== "UHERO") return true;
    if (this.scratch === 11011) return true;
    if (this.scratch === 90909) return true;
    if (/test/i.test(this.name)) return true;
    return false;
  }

  static #isValidUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Metadata integrity ──────────────────────────────────────────
  // Port of Rails Series.meta_integrity_check
  // Enforces implicational relationships between attributes.

  enforceMetaIntegrity(): void {
    if (this.frequency === "year") {
      this.seasonalAdjustment = "not_applicable";
    } else if (this.name && /NS$/i.test(Series.parseName(this.name).prefix)) {
      this.seasonalAdjustment = "not_seasonally_adjusted";
    }
  }

  // ─── In-memory data (non-persisted) ──────────────────────────────

  get data(): Map<string, number> {
    return this.#data ??= new Map();
  }

  set data(value: Map<string, number>) {
    this.#data = value;
  }

  get trimPeriodStart(): Date | null { return this.#trimStart; }
  set trimPeriodStart(d: Date | null) { this.#trimStart = d; }

  get trimPeriodEnd(): Date | null { return this.#trimEnd; }
  set trimPeriodEnd(d: Date | null) { this.#trimEnd = d; }

  get firstObservation(): string | null {
    const dates = [...this.data.keys()].filter((k) => this.data.get(k) != null).sort();
    return dates[0] ?? null;
  }

  get lastObservation(): string | null {
    const dates = [...this.data.keys()].filter((k) => this.data.get(k) != null).sort();
    return dates.at(-1) ?? null;
  }

  get observationCount(): number {
    return [...this.data.values()].filter((v) => v != null).length;
  }

  // ─── Serialization ───────────────────────────────────────────────

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      universe: this.universe,
      dataPortalName: this.dataPortalName,
      description: this.description,
      decimals: this.decimals,
      frequency: this.frequency,
      frequencyCode: this.frequencyCode,
      restricted: this.restricted,
      quarantined: this.quarantined,
      seasonalAdjustment: this.seasonalAdjustment,
      isPrimary: this.isPrimary,
      sourceLink: this.sourceLink,
    };
  }

  // ─── Stubs for domain logic (to be implemented) ──────────────────
  // These mirror the Rails model's richer methods. The Collection layer
  // handles the DB side; these handle the business logic.

  /** Rename series, updating dependents' loader evals. */
  rename(_newName: string): void { /* TODO */ }

  /** Duplicate this series under a new name. */
  duplicate(_newName: string, _overrides?: Partial<SeriesAttrs>): Series { /* TODO */ return this; }

  /** Create an alias of this series into another universe. */
  createAlias(_props: { universe: Universe; name?: string }): Series { /* TODO */ return this; }

  /** Reload all enabled data sources for this series. */
  reloadSources(_opts?: { nightly?: boolean; clearFirst?: boolean }): void { /* TODO */ }

  // ─── Arithmetic (series_arithmetic.rb) ────────────────────────────

  /**
   * Apply an arithmetic operation between this series and another series.
   * Iterates over dates from the longer series; dates where either value
   * is missing are excluded from the result.
   */
  private performArithmetic(op: string, other: Series): Series {
    const longerData = this.data.size >= other.data.size ? this.data : other.data;
    const newData = new Map<string, number>();

    for (const date of longerData.keys()) {
      const a = this.data.get(date);
      const b = other.data.get(date);
      if (a === undefined || b === undefined) continue;
      const result = doArithmetic(a, op, b);
      if (result !== null) newData.set(date, result);
    }

    const s = new Series({ name: `${this} ${op} ${other}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /**
   * Apply an arithmetic operation between this series and a constant.
   * Keeps all dates from the original series.
   */
  private performConstArithmetic(op: string, constant: number): Series {
    const newData = new Map<string, number>();

    for (const [date, value] of this.data) {
      const result = doArithmetic(value, op, constant);
      if (result !== null) newData.set(date, result);
    }

    const s = new Series({ name: `${this} ${op} ${constant}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Add another series or scalar to this series point-by-point. */
  add(other: Series | number): Series {
    return typeof other === "number"
      ? this.performConstArithmetic("+", other)
      : this.performArithmetic("+", other);
  }

  /** Subtract another series or scalar from this series. */
  subtract(other: Series | number): Series {
    return typeof other === "number"
      ? this.performConstArithmetic("-", other)
      : this.performArithmetic("-", other);
  }

  /** Multiply this series by another series or scalar. */
  multiply(other: Series | number): Series {
    return typeof other === "number"
      ? this.performConstArithmetic("*", other)
      : this.performArithmetic("*", other);
  }

  /** Divide this series by another series or scalar. */
  divide(other: Series | number): Series {
    return typeof other === "number"
      ? this.performConstArithmetic("/", other)
      : this.performArithmetic("/", other);
  }

  /** Raise this series to a power. */
  power(other: Series | number): Series {
    return typeof other === "number"
      ? this.performConstArithmetic("**", other)
      : this.performArithmetic("**", other);
  }

  /** Add with zero-fill: treat missing values as 0 before adding. */
  zeroAdd(other: Series): Series {
    const longerData = this.data.size >= other.data.size ? this.data : other.data;
    const newData = new Map<string, number>();

    for (const date of longerData.keys()) {
      const a = this.data.get(date) ?? 0;
      const b = other.data.get(date) ?? 0;
      newData.set(date, a + b);
    }

    const s = new Series({ name: `${this} zero_add ${other}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Round data values to the given precision. */
  round(precision = 0): Series {
    const factor = Math.pow(10, precision);
    const newData = new Map<string, number>();

    for (const [date, value] of this.data) {
      newData.set(date, Math.round(value * factor) / factor);
    }

    const s = new Series({ name: `${this} round ${precision}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Rebase the series so the given year equals 100. */
  rebase(_year?: number): Series { /* TODO */ return this; }

  /** Deflate nominal values using a price index series. */
  convertToReal(_index?: string): Series { /* TODO */ return this; }

  /** Per-capita transform: divide by population series. */
  perCap(_options?: { pop?: string; multiplier?: number }): Series { /* TODO */ return this; }

  /** Year-over-year percent change. */
  yoy(): Series { /* TODO */ return this; }

  /** Year-to-date cumulative sum. */
  ytd(): Series { /* TODO */ return this; }

  /** Period-over-period difference (lag defaults to 1). */
  diff(_lag?: number): Series { /* TODO */ return this; }

  /** Rolling annual sum (12-month for monthly, 4-quarter for quarterly). */
  annualSum(): Series { /* TODO */ return this; }

  /** Rolling annual average. */
  annualAverage(): Series { /* TODO */ return this; }

  /** Period-over-period percentage change. */
  percentageChange(): Series { /* TODO */ return this; }

  /** Year-over-year difference (level change, not percent). */
  yoyDiff(): Series { /* TODO */ return this; }

  /** Return data scaled by the given factor (does not mutate). */
  scaledData(scale = 1.0): Map<string, number> {
    const SENTINEL = 1.0e15;
    const result = new Map<string, number>();
    for (const [date, value] of this.data) {
      result.set(date, value === SENTINEL ? value : value * scale);
    }
    return result;
  }

  // ─── Aggregation (series_aggregation.rb) ──────────────────────────

  /** Aggregate to a lower frequency (e.g. month → quarter). */
  aggregate(_frequency: string, _operation?: string): Series { /* TODO */ return this; }

  // ─── Interpolation (series_interpolation.rb) ──────────────────────

  /** Fill gaps in monthly data with linear interpolation. */
  fillMissingMonthsLinear(): Series { /* TODO */ return this; }

  /** Interpolate to a target frequency using the given method. */
  interpolate(_targetFreq: string, _method?: string): Series { /* TODO */ return this; }

  /** Linear interpolation to the given frequency. */
  linearInterpolate(_frequency: string): Series { /* TODO */ return this; }

  /** Fill and interpolate to a target frequency. */
  fillInterpolateTo(_targetFrequency: string): Series { /* TODO */ return this; }

  // ─── Data adjustment (series_data_adjustment.rb) ──────────────────

  /** Trim data to the given date window. */
  trim(_startDate?: string, _endDate?: string): Series { /* TODO */ return this; }

  /** Shift all dates by a duration string (e.g. "1 year"). */
  shiftBy(_duration: string): Series { /* TODO */ return this; }

  // ─── File loading ───────────────────────────────────────────────────
  // File I/O is handled by the eval executor + DataFileReader (server-only).
  // These stubs exist so the ALLOWED_INSTANCE_METHODS whitelist in the
  // executor recognizes them; actual dispatch is intercepted before reaching here.

  /** Load data from a static file into this series. */
  loadFrom(_path: string): Series { throw new Error("loadFrom must be called via EvalExecutor"); }

  /** Load seasonally-adjusted data from a static file. */
  loadSaFrom(_path: string): Series { throw new Error("loadSaFrom must be called via EvalExecutor"); }
}

// ─── Errors ──────────────────────────────────────────────────────────

export class SeriesNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesNameError";
  }
}

export class SeriesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesValidationError";
  }
}

export class SeriesDestroyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesDestroyError";
  }
}

export default Series;
