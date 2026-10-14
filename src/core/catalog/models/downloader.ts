export type DownloaderAttrs = {
  id: number;
  handle: string;
  config?: string | Record<string, unknown> | null;
  state?: string | Record<string, unknown> | null;
  enabled?: boolean | number | null;
  reload_on_change?: boolean | number | null;
  max_age_minutes?: number | null;
  running_since?: Date | string | null;
  last_run_at?: Date | string | null;
  last_success_at?: Date | string | null;
  last_change_at?: Date | string | null;
  last_error?: string | null;
  last_error_at?: Date | string | null;
  last_run_seconds?: number | string | null;
  last_stats?: string | Record<string, unknown> | null;
  notes?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

/** JSON columns come back from Bun SQL as strings (MariaDB JSON = LONGTEXT). */
function parseJson(
  v: string | Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (v == null || v === "") return {};
  if (typeof v !== "string") return v;
  try {
    const parsed = JSON.parse(v) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toDate(v: Date | string | null | undefined): Date | null {
  return v ? new Date(v as string | Date) : null;
}

/** Plain-object shape returned by Downloader.toJSON(). */
export type SerializedDownloader = ReturnType<Downloader["toJSON"]>;

/**
 * A downloader row: the per-instance config, implementation-owned state
 * (e.g. the BLS history map) and the status of the last run. The code that
 * does the fetching lives in src/core/downloaders, keyed by `handle`.
 * DATETIME columns are HST wall-clock (see @catalog/utils/time).
 */
class Downloader {
  readonly id: number;
  handle: string;
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  enabled: boolean;
  /** Reserved; not read yet. */
  reloadOnChange: boolean;
  /** Load-time freshness gate; null = only scheduled / manual runs refresh the output. */
  maxAgeMinutes: number | null;
  runningSince: Date | null;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastChangeAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  lastRunSeconds: number | null;
  lastStats: Record<string, unknown>;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: DownloaderAttrs) {
    this.id = attrs.id;
    this.handle = attrs.handle;
    this.config = parseJson(attrs.config);
    this.state = parseJson(attrs.state);
    this.enabled = attrs.enabled == null ? true : Boolean(attrs.enabled);
    this.reloadOnChange = Boolean(attrs.reload_on_change);
    this.maxAgeMinutes = attrs.max_age_minutes ?? null;
    this.runningSince = toDate(attrs.running_since);
    this.lastRunAt = toDate(attrs.last_run_at);
    this.lastSuccessAt = toDate(attrs.last_success_at);
    this.lastChangeAt = toDate(attrs.last_change_at);
    this.lastError = attrs.last_error ?? null;
    this.lastErrorAt = toDate(attrs.last_error_at);
    this.lastRunSeconds =
      attrs.last_run_seconds == null ? null : Number(attrs.last_run_seconds);
    this.lastStats = parseJson(attrs.last_stats);
    this.notes = attrs.notes ?? null;
    this.createdAt = toDate(attrs.created_at);
    this.updatedAt = toDate(attrs.updated_at);
  }

  /** Typed read of a config value with a default. */
  configValue<T>(key: string, fallback: T): T {
    const v = this.config[key];
    return v === undefined || v === null ? fallback : (v as T);
  }

  toString(): string {
    return `Downloader#${this.id} <${this.handle}>`;
  }

  toJSON() {
    return {
      id: this.id,
      handle: this.handle,
      config: this.config,
      state: this.state,
      enabled: this.enabled,
      reloadOnChange: this.reloadOnChange,
      maxAgeMinutes: this.maxAgeMinutes,
      runningSince: this.runningSince?.toISOString() ?? null,
      lastRunAt: this.lastRunAt?.toISOString() ?? null,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastChangeAt: this.lastChangeAt?.toISOString() ?? null,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt?.toISOString() ?? null,
      lastRunSeconds: this.lastRunSeconds,
      lastStats: this.lastStats,
      notes: this.notes,
    };
  }
}

export default Downloader;
