import { isoOrNull, jsonObject, toDate } from "./ingest-columns";

export type DataExtractorAttrs = {
  id: number;
  handle: string;
  source_key: string;
  config?: unknown;
  enabled?: boolean | number | null;
  running_since?: Date | string | null;
  notes?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

export type SerializedDataExtractor = ReturnType<DataExtractor["toJSON"]>;

/**
 * An extraction: parses its input downloaders' stored raw files into the
 * standard long format (declared dimensions, date, value). `sourceKey`
 * names the parser module (src/core/ingest/registry.ts); several
 * extractors may share a module with different config. Load statements
 * address an extractor by `handle`:
 *   Series.load_from_extract("dotax", { type: "collec", ... })
 */
class DataExtractor {
  readonly id: number;
  handle: string;
  sourceKey: string;
  config: Record<string, unknown>;
  enabled: boolean;
  runningSince: Date | null;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: DataExtractorAttrs) {
    this.id = attrs.id;
    this.handle = attrs.handle;
    this.sourceKey = attrs.source_key;
    this.config = jsonObject(attrs.config);
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
    return `DataExtractor#${this.id} <${this.handle}>`;
  }

  toJSON() {
    return {
      id: this.id,
      handle: this.handle,
      sourceKey: this.sourceKey,
      config: this.config,
      enabled: this.enabled,
      runningSince: isoOrNull(this.runningSince),
      notes: this.notes,
      createdAt: isoOrNull(this.createdAt),
      updatedAt: isoOrNull(this.updatedAt),
    };
  }
}

export default DataExtractor;
