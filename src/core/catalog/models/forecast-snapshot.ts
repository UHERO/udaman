import { createHash } from "node:crypto";
import { join } from "node:path";

import { getDataDir } from "@/lib/data-dir";

export type ForecastSnapshotAttrs = {
  id: number;
  name?: string | null;
  version?: string | null;
  published?: boolean | number | null;
  comments?: string | null;
  new_forecast_tsd_filename?: string | null;
  new_forecast_tsd_label?: string | null;
  old_forecast_tsd_filename?: string | null;
  old_forecast_tsd_label?: string | null;
  history_tsd_filename?: string | null;
  history_tsd_label?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

export type SerializedForecastSnapshot = ReturnType<
  ForecastSnapshot["toJSON"]
>;

/**
 * Format a Date matching Ruby's `created_at.utc.to_s`: "YYYY-MM-DD HH:MM:SS UTC".
 *
 * Rails stored DATETIME values in UTC, but MariaDB DATETIME columns are timezone-
 * unaware. Bun's SQL driver interprets them as local time, so the JS Date object's
 * local accessors (getHours, etc.) correspond to the raw DB value — which is what
 * Rails used to compute the MD5 hash. We use local accessors here to reproduce the
 * same string the Rails app hashed.
 */
function formatRubyUtcDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} UTC`
  );
}

class ForecastSnapshot {
  readonly id: number;
  name: string | null;
  version: string | null;
  published: boolean;
  comments: string | null;
  newForecastTsdFilename: string | null;
  newForecastTsdLabel: string | null;
  oldForecastTsdFilename: string | null;
  oldForecastTsdLabel: string | null;
  historyTsdFilename: string | null;
  historyTsdLabel: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: ForecastSnapshotAttrs) {
    this.id = attrs.id;
    this.name = attrs.name ?? null;
    this.version = attrs.version ?? null;
    this.published = Boolean(attrs.published);
    this.comments = attrs.comments ?? null;
    this.newForecastTsdFilename = attrs.new_forecast_tsd_filename ?? null;
    this.newForecastTsdLabel = attrs.new_forecast_tsd_label ?? null;
    this.oldForecastTsdFilename = attrs.old_forecast_tsd_filename ?? null;
    this.oldForecastTsdLabel = attrs.old_forecast_tsd_label ?? null;
    this.historyTsdFilename = attrs.history_tsd_filename ?? null;
    this.historyTsdLabel = attrs.history_tsd_label ?? null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  /** Build the relative file path under tsd_files/ using MD5 hash (matches Rails logic) */
  tsdRelFilepath(filename: string): string {
    // Guard against path traversal
    if (/[\\]*\.[\\]*\./.test(filename)) {
      throw new Error(`Invalid filename: ${filename}`);
    }
    // Must match Ruby: '%s_%d_%s' % [created_at.utc, id, name]
    // Ruby DateTime#to_s => "2017-01-14 00:44:45 UTC"
    const dateStr = this.createdAt
      ? formatRubyUtcDate(this.createdAt)
      : "";
    const str = `${dateStr}_${this.id}_${filename}`;
    const hash = createHash("md5").update(str).digest("hex");
    return join("tsd_files", `${hash}_${filename}`);
  }

  /** Full disk path for a TSD file */
  filePath(filename: string): string {
    return join(getDataDir(), this.tsdRelFilepath(filename));
  }

  toString(): string {
    return `ForecastSnapshot#${this.id} ${this.name} v${this.version}`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      published: this.published,
      comments: this.comments,
      newForecastTsdFilename: this.newForecastTsdFilename,
      newForecastTsdLabel: this.newForecastTsdLabel,
      oldForecastTsdFilename: this.oldForecastTsdFilename,
      oldForecastTsdLabel: this.oldForecastTsdLabel,
      historyTsdFilename: this.historyTsdFilename,
      historyTsdLabel: this.historyTsdLabel,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export default ForecastSnapshot;
