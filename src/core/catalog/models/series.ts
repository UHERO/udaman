import type {
  AnalyzeSeriesData,
  SeasonalAdjustment,
  Universe,
} from "../types/shared";

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

// ─── Frequency helpers ──────────────────────────────────────────────

/** Numeric ordering of frequencies (higher number = higher frequency). */
const FREQ_ORDER: Record<string, number> = {
  year: 1,
  semi: 2,
  quarter: 4,
  month: 12,
  week: 52,
  day: 365,
};

/** Return the numeric ordering for a frequency string or code. */
function freqn(freq: string | null | undefined): number {
  if (!freq) return 0;
  const normalized = freq.toLowerCase().replace(/ly$/, "");
  return (
    FREQ_ORDER[normalized] ??
    FREQ_ORDER[FREQ_CODE_TO_LONG[freq.toUpperCase() as FrequencyCode]] ??
    0
  );
}

/**
 * Return how many higher-frequency units fit in one lower-frequency unit.
 * e.g. freqPerFreq("month", "year") → 12, freqPerFreq("quarter", "year") → 4
 */
function freqPerFreq(higher: string, lower: string): number | null {
  const h = normalizeFreq(higher);
  const l = normalizeFreq(lower);
  if (l === h) return 1;
  const table: Record<string, Record<string, number>> = {
    year: { semi: 2, quarter: 4, month: 12 },
    semi: { quarter: 2, month: 6 },
    quarter: { month: 3 },
    week: { day: 7 },
  };
  return table[l]?.[h] ?? null;
}

function normalizeFreq(freq: string): string {
  const lower = freq.toLowerCase().replace(/ly$/, "");
  return FREQ_CODE_TO_LONG[freq.toUpperCase() as FrequencyCode] ?? lower;
}

// ─── Date helpers ───────────────────────────────────────────────────

/** Return the start-of-period date string for a given frequency. */
function periodStart(dateStr: string, freq: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based
  switch (normalizeFreq(freq)) {
    case "year":
      return `${y}-01-01`;
    case "semi":
      return m < 6 ? `${y}-01-01` : `${y}-07-01`;
    case "quarter": {
      const qMonth = Math.floor(m / 3) * 3 + 1;
      return `${y}-${String(qMonth).padStart(2, "0")}-01`;
    }
    case "month":
      return `${y}-${String(m + 1).padStart(2, "0")}-01`;
    case "week": {
      // ISO week start (Monday)
      const day = d.getDay();
      const diff = (day + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - diff);
      return monday.toISOString().slice(0, 10);
    }
    default:
      return dateStr;
  }
}

/** Add n months to a YYYY-MM-DD date string. */
function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  // Clamp day to end of month (e.g. Jan 31 + 1 month → Feb 28)
  return d.toISOString().slice(0, 10);
}

/** Format YYYY-MM-DD from components. */
function fmtDate(y: number, m: number, d = 1): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parse a date string into {year, month}. */
function parseYM(dateStr: string): { year: number; month: number } {
  const d = new Date(dateStr + "T00:00:00");
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// ─── Aggregation helpers ────────────────────────────────────────────

type AggOp = "sum" | "average" | "min" | "max" | "first" | "last";

function applyAggOp(values: number[], op: AggOp): number {
  switch (op) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "average":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "first":
      return values[0];
    case "last":
      return values[values.length - 1];
  }
}

/** Apply a single arithmetic operation. Returns null for NaN/Infinity. */
function doArithmetic(a: number, op: string, b: number): number | null {
  let result: number;
  switch (op) {
    case "+":
      result = a + b;
      break;
    case "-":
      result = a - b;
      break;
    case "*":
      result = a * b;
      break;
    case "/":
      result = a / b;
      break;
    case "**":
      result = a ** b;
      break;
    default:
      return null;
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
  // joined from units table (optional)
  unit_short_label?: string | null;
  unit_long_label?: string | null;
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

  // joined from units table (may be null if not joined)
  unitLabel: string | null;
  unitShortLabel: string | null;

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
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;

    // xseries
    this.primarySeriesId = attrs.primary_series_id ?? null;
    this.frequency = attrs.frequency ?? null;
    this.restricted = Boolean(attrs.restricted);
    this.quarantined = Boolean(attrs.quarantined);
    this.seasonalAdjustment =
      (attrs.seasonal_adjustment as SeasonalAdjustment) ?? null;
    this.seasonallyAdjusted =
      attrs.seasonally_adjusted != null
        ? Boolean(attrs.seasonally_adjusted)
        : null;
    this.aremossMissing = attrs.aremos_missing ?? null;
    this.aremosDiff = attrs.aremos_diff ?? null;
    this.percent = attrs.percent != null ? Boolean(attrs.percent) : null;
    this.real = attrs.real != null ? Boolean(attrs.real) : null;

    // joined unit label
    this.unitLabel = attrs.unit_long_label || attrs.unit_short_label || null;
    this.unitShortLabel = attrs.unit_short_label ?? null;
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
      version:
        m[5]?.toUpperCase() === "F" ? (m[6]?.toUpperCase() ?? null) : null,
      history:
        m[5]?.toUpperCase() === "H" ? (m[6]?.toUpperCase() ?? null) : null,
      geo: m[7].toUpperCase(),
      freq: freqCode ?? null,
      freqLong: freqCode ? (FREQ_CODE_TO_LONG[freqCode] ?? null) : null,
    };
  }

  parseName(): ParsedName {
    return Series.parseName(this.name);
  }

  static buildName(prefix: string, geo: string, freq?: string | null): string {
    if (!prefix?.trim() || !geo?.trim()) {
      throw new Error(
        `Empty prefix ("${prefix}") and/or geography ("${geo}") not allowed`,
      );
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

  static frequencyFromCode(
    code: string | null | undefined,
  ): FrequencyLong | null {
    if (!code) return null;
    return FREQ_CODE_TO_LONG[code.toUpperCase() as FrequencyCode] ?? null;
  }

  static codeFromFrequency(
    freq: string | null | undefined,
  ): FrequencyCode | null {
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
    return this.buildName({
      prefix: this.parseName().prefix.replace(/NS$/i, ""),
    });
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
    return (this.#data ??= new Map());
  }

  set data(value: Map<string, number>) {
    this.#data = value;
  }

  get trimPeriodStart(): Date | null {
    return this.#trimStart;
  }
  set trimPeriodStart(d: Date | null) {
    this.#trimStart = d;
  }

  get trimPeriodEnd(): Date | null {
    return this.#trimEnd;
  }
  set trimPeriodEnd(d: Date | null) {
    this.#trimEnd = d;
  }

  get firstObservation(): string | null {
    const dates = [...this.data.keys()]
      .filter((k) => this.data.get(k) != null)
      .sort();
    return dates[0] ?? null;
  }

  get lastObservation(): string | null {
    const dates = [...this.data.keys()]
      .filter((k) => this.data.get(k) != null)
      .sort();
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
  rename(_newName: string): void {
    /* TODO */
  }

  /** Duplicate this series under a new name. */
  duplicate(_newName: string, _overrides?: Partial<SeriesAttrs>): Series {
    /* TODO */ return this;
  }

  /** Create an alias of this series into another universe. */
  createAlias(_props: { universe: Universe; name?: string }): Series {
    /* TODO */ return this;
  }

  /** Reload all enabled data sources for this series. */
  reloadSources(_opts?: { nightly?: boolean; clearFirst?: boolean }): void {
    /* TODO */
  }

  // ─── Arithmetic (series_arithmetic.rb) ────────────────────────────

  /**
   * Apply an arithmetic operation between this series and another series.
   * Iterates over dates from the longer series; dates where either value
   * is missing are excluded from the result.
   */
  private performArithmetic(op: string, other: Series): Series {
    const longerData =
      this.data.size >= other.data.size ? this.data : other.data;
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
    const longerData =
      this.data.size >= other.data.size ? this.data : other.data;
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
  rebase(_year?: number): Series {
    /* TODO */ return this;
  }

  /** Deflate nominal values using a price index series. */
  convertToReal(_index?: string): Series {
    /* TODO */ return this;
  }

  /** Per-capita transform: divide by population series. */
  perCap(_options?: { pop?: string; multiplier?: number }): Series {
    /* TODO */ return this;
  }

  /** Year-over-year percent change. */
  yoy(): Series {
    const newData = new Map<string, number>();
    for (const [dateStr, value] of this.data) {
      const prevDate = addMonths(dateStr, -12);
      const prevVal = this.data.get(prevDate);
      if (prevVal == null) continue;
      if (prevVal === 0 && value !== 0) continue;
      if (prevVal === 0 && value === 0) {
        newData.set(dateStr, 0);
        continue;
      }
      newData.set(dateStr, ((value - prevVal) / prevVal) * 100);
    }
    const s = new Series({ name: `Annualized percentage change of ${this}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Year-to-date: YTD cumulative sum, then YOY of that. */
  ytd(): Series {
    return this.ytdSum().yoy();
  }

  /** Year-to-date cumulative sum. */
  ytdSum(): Series {
    const sorted = [...this.data.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const newData = new Map<string, number>();
    let trackYear: number | null = null;
    let cumSum = 0;

    for (const [dateStr, value] of sorted) {
      const { year } = parseYM(dateStr);
      if (year !== trackYear) {
        trackYear = year;
        cumSum = 0;
      }
      cumSum += value;
      newData.set(dateStr, cumSum);
    }

    const s = new Series({ name: `Year-to-date sum of ${this}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Period-over-period difference (lag defaults to 1 observation). */
  diff(lag = 1): Series {
    const sorted = [...this.data.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const newData = new Map<string, number>();

    for (let i = lag; i < sorted.length; i++) {
      const [date, value] = sorted[i];
      const prevVal = sorted[i - lag][1];
      if (prevVal != null) {
        newData.set(date, value - prevVal);
      }
    }

    const s = new Series({ name: `Difference of ${this} w/lag of ${lag}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /**
   * Annual sum: aggregate to annual sum, then map back to each observation date.
   * Each data point gets the annual sum for its year.
   */
  annualSum(): Series {
    // Aggregate to annual sums (without pruning — we need all years)
    const annualSums = new Map<number, { sum: number; count: number }>();
    for (const [dateStr, value] of this.data) {
      const { year } = parseYM(dateStr);
      const entry = annualSums.get(year);
      if (entry) {
        entry.sum += value;
        entry.count++;
      } else annualSums.set(year, { sum: value, count: 1 });
    }

    // Prune incomplete years
    const expectedPerYear = freqPerFreq(
      normalizeFreq(this.frequency ?? ""),
      "year",
    );
    const newData = new Map<string, number>();
    for (const [dateStr] of this.data) {
      const { year } = parseYM(dateStr);
      const entry = annualSums.get(year);
      if (!entry) continue;
      if (expectedPerYear && entry.count < expectedPerYear) continue;
      newData.set(dateStr, entry.sum);
    }

    const s = new Series({ name: `Annual sum of ${this.name}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /**
   * Annual average: aggregate to annual average, then map back to each observation date.
   * Each data point gets the annual average for its year.
   */
  annualAverage(): Series {
    const annualGroups = new Map<number, { sum: number; count: number }>();
    for (const [dateStr, value] of this.data) {
      const { year } = parseYM(dateStr);
      const entry = annualGroups.get(year);
      if (entry) {
        entry.sum += value;
        entry.count++;
      } else annualGroups.set(year, { sum: value, count: 1 });
    }

    const expectedPerYear = freqPerFreq(
      normalizeFreq(this.frequency ?? ""),
      "year",
    );
    const newData = new Map<string, number>();
    for (const [dateStr] of this.data) {
      const { year } = parseYM(dateStr);
      const entry = annualGroups.get(year);
      if (!entry) continue;
      if (expectedPerYear && entry.count < expectedPerYear) continue;
      newData.set(dateStr, entry.sum / entry.count);
    }

    const s = new Series({ name: `Annual average of ${this.name}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Period-over-period percentage change. */
  percentageChange(): Series {
    const sorted = [...this.data.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const newData = new Map<string, number>();

    for (let i = 1; i < sorted.length; i++) {
      const [date, current] = sorted[i];
      const prev = sorted[i - 1][1];
      if (prev == null || current == null) continue;
      if (prev === 0 && current !== 0) continue;
      if (prev === 0 && current === 0) {
        newData.set(date, 0);
        continue;
      }
      newData.set(date, ((current - prev) / prev) * 100);
    }

    const s = new Series({ name: `Percentage change of ${this}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Year-over-year difference (level change, not percent). */
  yoyDiff(): Series {
    const newData = new Map<string, number>();
    for (const [dateStr, value] of this.data) {
      const prevDate = addMonths(dateStr, -12);
      const prevVal = this.data.get(prevDate);
      if (prevVal == null) continue;
      newData.set(dateStr, value - prevVal);
    }
    const s = new Series({ name: `Year over year diff of ${this}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

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
  aggregate(frequency: string, operation?: string): Series {
    const targetFreq = normalizeFreq(frequency);
    const srcFreq = normalizeFreq(this.frequency ?? "");

    if (!["year", "semi", "quarter", "month", "week"].includes(targetFreq)) {
      throw new Error(`Cannot aggregate to frequency ${frequency}`);
    }
    if (freqn(targetFreq) >= freqn(srcFreq)) {
      throw new Error("Can only aggregate to a lower frequency");
    }

    const op = (operation ?? "average") as AggOp;

    // Group data points by target-frequency period start date
    const groups = new Map<string, number[]>();
    const sortedDates = [...this.data.keys()].sort();
    for (const date of sortedDates) {
      const value = this.data.get(date);
      if (value == null) continue;
      const key = periodStart(date, targetFreq);
      const arr = groups.get(key);
      if (arr) arr.push(value);
      else groups.set(key, [value]);
    }

    // Prune incomplete periods
    const minPoints = freqPerFreq(srcFreq, targetFreq);
    const newData = new Map<string, number>();
    for (const [date, values] of groups) {
      if (minPoints && values.length < minPoints) continue;
      newData.set(date, applyAggOp(values, op));
    }

    const s = new Series({ name: `Aggregated as ${op} from ${this}` });
    s.data = newData;
    s.frequency = targetFreq;
    return s;
  }

  // ─── Interpolation (series_interpolation.rb) ──────────────────────

  /** Fill gaps in monthly data with linear interpolation. */
  fillMissingMonthsLinear(): Series {
    if (normalizeFreq(this.frequency ?? "") !== "month") {
      throw new Error("Must be a monthly series");
    }

    const sorted = [...this.data.entries()]
      .filter(([, v]) => v != null)
      .sort(([a], [b]) => a.localeCompare(b));
    if (sorted.length < 2) throw new Error("Must have at least two points");

    const newData = new Map<string, number>();

    for (let i = 0; i < sorted.length - 1; i++) {
      const [dateStr1, val1] = sorted[i];
      const [dateStr2, val2] = sorted[i + 1];

      newData.set(dateStr1, val1);

      const ym1 = parseYM(dateStr1);
      const ym2 = parseYM(dateStr2);
      const gap = ym2.year * 12 + ym2.month - (ym1.year * 12 + ym1.month) - 1;
      const step = (val2 - val1) / (gap + 1);

      for (let m = 1; m <= gap; m++) {
        newData.set(addMonths(dateStr1, m), val1 + step * m);
      }
    }

    const [lastDate, lastVal] = sorted[sorted.length - 1];
    newData.set(lastDate, lastVal);

    const s = new Series({ name: `Linear month gap fill for ${this.name}` });
    s.data = newData;
    s.frequency = "month";
    return s;
  }

  /**
   * AREMOS-style interpolation to a higher frequency.
   * method: "average" (default) or "sum"
   */
  interpolate(targetFreq: string, method: string = "average"): Series {
    const target = normalizeFreq(targetFreq);
    const src = normalizeFreq(this.frequency ?? "");

    if (method !== "average" && method !== "sum") {
      throw new Error(`Interpolation method ${method} not supported`);
    }
    if (freqn(target) <= freqn(src)) {
      throw new Error("Can only interpolate to a higher frequency");
    }
    if (this.data.size < 2) throw new Error("Insufficient data");

    const howMany = freqPerFreq(target, src);
    const targetMonths = freqPerFreq("month", target);
    if (!howMany || !targetMonths) {
      throw new Error(`Interpolation from ${src} to ${target} not supported`);
    }

    const allFactors: Record<string, Record<string, number[]>> = {
      year: { quarter: [-1.5, -0.5, 0.5, 1.5] },
      semi: { quarter: [-0.5, 0.5], month: [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] },
      quarter: { month: [-1, 0, 1] },
    };

    const factors = allFactors[src]?.[target];
    if (!factors) {
      throw new Error(
        `Interpolation from ${src} to ${target} not yet supported`,
      );
    }

    const sorted = [...this.data.entries()]
      .filter(([, v]) => v != null)
      .sort(([a], [b]) => a.localeCompare(b));

    const newData = new Map<string, number>();
    let lastDate: string | null = null;
    let lastVal: number | null = null;
    let increment = 0;

    for (const [thisDate, thisVal] of sorted) {
      if (lastVal !== null && lastDate !== null) {
        increment = (thisVal - lastVal) / howMany;
        let values = factors.map((f) => lastVal! + f * increment);
        if (method === "sum") values = values.map((v) => v / howMany);
        for (let t = 0; t < howMany; t++) {
          newData.set(addMonths(lastDate, t * targetMonths), values[t]);
        }
      }
      lastDate = thisDate;
      lastVal = thisVal;
    }

    // Repeat for final observation
    if (lastDate !== null && lastVal !== null) {
      let values = factors.map((f) => lastVal! + f * increment);
      if (method === "sum") values = values.map((v) => v / howMany);
      for (let t = 0; t < howMany; t++) {
        newData.set(addMonths(lastDate, t * targetMonths), values[t]);
      }
    }

    const s = new Series({
      name: `Interpolated by ${method} method from ${this}`,
    });
    s.data = newData;
    s.frequency = target;
    return s;
  }

  /** Linear match-last interpolation to the given frequency. */
  linearInterpolate(frequency: string): Series {
    const target = normalizeFreq(frequency);
    const src = normalizeFreq(this.frequency ?? "");

    const valid =
      (src === "year" && target === "quarter") ||
      (src === "quarter" && target === "month");
    if (!valid)
      throw new Error(`Cannot linear interpolate from ${src} to ${target}`);

    const sorted = [...this.data.entries()]
      .filter(([, v]) => v != null)
      .sort(([a], [b]) => a.localeCompare(b));
    if (sorted.length < 2) throw new Error("Insufficient data");

    const newData = new Map<string, number>();

    // First point: no diff, so interpolate with diff=0
    const [firstDate, firstVal] = sorted[0];
    if (src === "year" && target === "quarter") {
      newData.set(firstDate, firstVal);
      newData.set(addMonths(firstDate, 3), firstVal);
      newData.set(addMonths(firstDate, 6), firstVal);
      newData.set(addMonths(firstDate, 9), firstVal);
    } else {
      newData.set(firstDate, firstVal);
      newData.set(addMonths(firstDate, 1), firstVal);
      newData.set(addMonths(firstDate, 2), firstVal);
    }

    for (let i = 1; i < sorted.length; i++) {
      const [date, val] = sorted[i];
      const diff = val - sorted[i - 1][1];

      if (src === "year" && target === "quarter") {
        newData.set(date, val - (diff / 4) * 3);
        newData.set(addMonths(date, 3), val - (diff / 4) * 2);
        newData.set(addMonths(date, 6), val - diff / 4);
        newData.set(addMonths(date, 9), val);
      } else {
        // quarter → month
        newData.set(date, val - (diff / 3) * 2);
        newData.set(addMonths(date, 1), val - diff / 3);
        newData.set(addMonths(date, 2), val);
      }
    }

    const s = new Series({
      name: `Interpolated (linear match last) from ${this}`,
    });
    s.data = newData;
    s.frequency = target;
    return s;
  }

  /** Fill-interpolate to a target frequency (repeats each value across sub-periods). */
  fillInterpolateTo(targetFrequency: string): Series {
    const target = normalizeFreq(targetFrequency);
    const src = normalizeFreq(this.frequency ?? "");

    if (src !== "year") {
      throw new Error(
        `fill_interpolate_to only supports annual source, got ${src}`,
      );
    }

    let monthValues: number[];
    if (target === "quarter") {
      monthValues = [1, 4, 7, 10];
    } else if (target === "month") {
      monthValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    } else {
      throw new Error(`Cannot fill-interpolate from ${src} to ${target}`);
    }

    const newData = new Map<string, number>();
    for (const [dateStr, val] of this.data) {
      const { year } = parseYM(dateStr);
      for (const month of monthValues) {
        newData.set(fmtDate(year, month), val);
      }
    }

    const s = new Series({
      name: `Interpolated by filling ${this} to ${target}`,
    });
    s.data = newData;
    s.frequency = target;
    return s;
  }

  // ─── Moving averages (series_sharing.rb) ─────────────────────────

  /** Standard window size for moving averages based on frequency. */
  private get standardWindowSize(): number {
    switch (normalizeFreq(this.frequency ?? "")) {
      case "day":
        return 7;
      case "month":
        return 12;
      case "week":
      case "quarter":
      case "year":
        return 4;
      default:
        throw new Error(
          `No window size defined for frequency ${this.frequency}`,
        );
    }
  }

  /**
   * Backward-looking moving average.
   * Each point is the average of itself and the (window-1) preceding points.
   */
  backwardLookingMovingAverage(window?: number): Series {
    const periods = window ?? this.standardWindowSize;
    const sorted = [...this.data.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const newData = new Map<string, number>();

    for (let i = 0; i < sorted.length; i++) {
      const start = i - periods + 1;
      if (start < 0) continue;
      let sum = 0;
      for (let j = start; j <= i; j++) sum += sorted[j][1];
      newData.set(sorted[i][0], sum / periods);
    }

    const s = new Series({
      name: `Backward-looking moving average of ${this}`,
    });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Forward-looking moving average. */
  forwardLookingMovingAverage(window?: number): Series {
    const periods = window ?? this.standardWindowSize;
    const sorted = [...this.data.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const newData = new Map<string, number>();

    for (let i = 0; i < sorted.length; i++) {
      const end = i + periods - 1;
      if (end >= sorted.length) continue;
      let sum = 0;
      for (let j = i; j <= end; j++) sum += sorted[j][1];
      newData.set(sorted[i][0], sum / periods);
    }

    const s = new Series({ name: `Forward-looking moving average of ${this}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Centered moving average with edge fallback to forward/backward. */
  movingAverage(): Series {
    const periods = this.standardWindowSize;
    const half = Math.floor(periods / 2);
    const sorted = [...this.data.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const last = sorted.length - 1;
    const newData = new Map<string, number>();

    for (let i = 0; i < sorted.length; i++) {
      let start: number, end: number;
      if (i < half) {
        // left edge: forward-looking
        start = i;
        end = i + periods - 1;
      } else if (i > last - half) {
        // right edge: backward-looking
        start = i - periods + 1;
        end = i;
      } else {
        // centered
        start = i - half;
        end = i + half;
      }
      if (start < 0 || end >= sorted.length) continue;
      let sum = 0;
      for (let j = start; j <= end; j++) sum += sorted[j][1];
      newData.set(sorted[i][0], sum / (end - start + 1));
    }

    const s = new Series({ name: `Moving average of ${this}` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Get data for the last incomplete year (current year if not finished). */
  getLastIncompleteYear(): Series {
    const lastObs = this.lastObservation;
    if (!lastObs) {
      const s = new Series({ name: `No data because no incomplete year` });
      s.frequency = this.frequency;
      return s;
    }
    const { year, month } = parseYM(lastObs);
    const freq = normalizeFreq(this.frequency ?? "");
    if (
      (freq === "month" && month === 12) ||
      (freq === "quarter" && month === 10)
    ) {
      const s = new Series({ name: `No data because no incomplete year` });
      s.frequency = this.frequency;
      return s;
    }
    return this.trim(fmtDate(year, 1));
  }

  // ─── Data adjustment (series_data_adjustment.rb) ──────────────────

  /** Trim data to a date window. Either or both bounds may be omitted. */
  trim(startDate?: string | null, endDate?: string | null): Series {
    const newData = new Map<string, number>();
    for (const [dateStr, value] of this.data) {
      if (startDate && dateStr < startDate) continue;
      if (endDate && dateStr > endDate) continue;
      newData.set(dateStr, value);
    }
    const s = new Series({ name: `${this} trimmed` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  /** Shift all dates by n months. */
  shiftBy(months: number): Series {
    const newData = new Map<string, number>();
    for (const [dateStr, value] of this.data) {
      newData.set(addMonths(dateStr, months), value);
    }
    const s = new Series({ name: `${this} shifted by ${months} months` });
    s.data = newData;
    s.frequency = this.frequency;
    return s;
  }

  // ─── File loading ───────────────────────────────────────────────────
  // File I/O is handled by the eval executor + DataFileReader (server-only).
  // These stubs exist so the ALLOWED_INSTANCE_METHODS whitelist in the
  // executor recognizes them; actual dispatch is intercepted before reaching here.

  /** Load data from a static file into this series. */
  loadFrom(_path: string): Series {
    throw new Error("loadFrom must be called via EvalExecutor");
  }

  /** Load seasonally-adjusted data from a static file. */
  loadSaFrom(_path: string): Series {
    throw new Error("loadSaFrom must be called via EvalExecutor");
  }

  // ─── Statistics ──────────────────────────────────────────────────────

  /** Sum all non-null values. */
  sum(): number {
    let total = 0;
    for (const v of this.data.values()) {
      if (v != null) total += v;
    }
    return total;
  }

  /** Arithmetic mean of non-null values. Returns 0 if empty. */
  mean(): number {
    const n = this.observationCount;
    return n > 0 ? this.sum() / n : 0;
  }

  /** Sample variance (n-1 denominator). */
  variance(): number {
    const n = this.observationCount;
    if (n <= 1) return 0;
    const avg = this.mean();
    let sumSq = 0;
    for (const v of this.data.values()) {
      if (v != null) sumSq += (v - avg) ** 2;
    }
    return sumSq / (n - 1);
  }

  /** Sample standard deviation. */
  standardDeviation(): number {
    return Math.sqrt(this.variance());
  }

  /** Median of non-null values. Returns null if empty. */
  median(): number | null {
    const values = [...this.data.values()]
      .filter((v) => v != null)
      .sort((a, b) => a - b);
    if (values.length === 0) return null;
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 1
      ? values[mid]
      : (values[mid - 1] + values[mid]) / 2;
  }

  // ─── Analyze serialization ──────────────────────────────────────────

  /** Serialize for the analyze page: identity fields + sorted [date, value] tuples. */
  toAnalyzeJSON(): AnalyzeSeriesData {
    const sorted = [...this.data.entries()]
      .filter(([, v]) => v != null)
      .sort(([a], [b]) => a.localeCompare(b));
    return {
      id: this.id,
      name: this.name,
      dataPortalName: this.dataPortalName,
      universe: this.universe,
      frequency: this.frequency,
      frequencyCode: this.frequencyCode,
      decimals: this.decimals,
      observationCount: this.observationCount,
      data: sorted,
    };
  }
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
