import { isoOrNull, jsonObject, toDate } from "./ingest-columns";

/**
 * How a downloader fetches. `custom` runs the source module's own fetch();
 * the others are driven by config alone. api / headless come later.
 */
export const INGEST_STRATEGIES = [
  "static_url",
  "discover_from_page",
  "custom",
] as const;
export type IngestStrategy = (typeof INGEST_STRATEGIES)[number];

export function isIngestStrategy(s: unknown): s is IngestStrategy {
  return (INGEST_STRATEGIES as readonly unknown[]).includes(s);
}

export type DataDownloaderAttrs = {
  id: number;
  handle: string;
  source_key?: string | null;
  strategy?: string | null;
  config?: unknown;
  state?: unknown;
  schedule?: string | null;
  enabled?: boolean | number | null;
  running_since?: Date | string | null;
  notes?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

export type SerializedDataDownloader = ReturnType<DataDownloader["toJSON"]>;

/**
 * A thing fetched: one file, a set of discovered files, or an API. It
 * stores raw files unchanged as RawArtifacts and never parses values out
 * of them. The fetch code is the source module named by `sourceKey`
 * (src/core/ingest/registry.ts) when `strategy` is custom.
 */
class DataDownloader {
  readonly id: number;
  handle: string;
  sourceKey: string | null;
  strategy: IngestStrategy;
  config: Record<string, unknown>;
  /** Implementation-owned bookkeeping between runs. */
  state: Record<string, unknown>;
  /** Cron pattern (Pacific/Honolulu); null = manual runs only. */
  schedule: string | null;
  enabled: boolean;
  runningSince: Date | null;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: DataDownloaderAttrs) {
    this.id = attrs.id;
    this.handle = attrs.handle;
    this.sourceKey = attrs.source_key ?? null;
    this.strategy = isIngestStrategy(attrs.strategy)
      ? attrs.strategy
      : "custom";
    this.config = jsonObject(attrs.config);
    this.state = jsonObject(attrs.state);
    this.schedule = attrs.schedule?.trim() || null;
    this.enabled = attrs.enabled == null ? true : Boolean(attrs.enabled);
    this.runningSince = toDate(attrs.running_since);
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
    return `DataDownloader#${this.id} <${this.handle}>`;
  }

  toJSON() {
    return {
      id: this.id,
      handle: this.handle,
      sourceKey: this.sourceKey,
      strategy: this.strategy,
      config: this.config,
      state: this.state,
      schedule: this.schedule,
      enabled: this.enabled,
      runningSince: isoOrNull(this.runningSince),
      notes: this.notes,
      createdAt: isoOrNull(this.createdAt),
      updatedAt: isoOrNull(this.updatedAt),
    };
  }
}

export default DataDownloader;
