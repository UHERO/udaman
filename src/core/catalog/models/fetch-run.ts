import { isoOrNull, jsonObject, toDate } from "./ingest-columns";

export const FETCH_RUN_STATUSES = [
  "running",
  "ok",
  "unchanged",
  "failed",
] as const;
/** ok = at least one new vintage stored; unchanged = every key already stored. */
export type FetchRunStatus = (typeof FETCH_RUN_STATUSES)[number];

export type FetchRunAttrs = {
  id: number;
  downloader_id: number;
  status: string;
  triggered_by?: string | null;
  error?: string | null;
  stats?: unknown;
  started_at: Date | string;
  finished_at?: Date | string | null;
};

export type SerializedFetchRun = ReturnType<FetchRun["toJSON"]>;

/** One fetch attempt of a DataDownloader. */
class FetchRun {
  readonly id: number;
  downloaderId: number;
  status: FetchRunStatus;
  /** schedule | cli | user:<id> | ... */
  triggeredBy: string | null;
  error: string | null;
  stats: Record<string, unknown>;
  startedAt: Date;
  finishedAt: Date | null;

  constructor(attrs: FetchRunAttrs) {
    this.id = attrs.id;
    this.downloaderId = attrs.downloader_id;
    this.status = (FETCH_RUN_STATUSES as readonly string[]).includes(
      attrs.status,
    )
      ? (attrs.status as FetchRunStatus)
      : "failed";
    this.triggeredBy = attrs.triggered_by ?? null;
    this.error = attrs.error ?? null;
    this.stats = jsonObject(attrs.stats);
    this.startedAt = toDate(attrs.started_at)!;
    this.finishedAt = toDate(attrs.finished_at);
  }

  toString(): string {
    return `FetchRun#${this.id} <${this.status}>`;
  }

  toJSON() {
    return {
      id: this.id,
      downloaderId: this.downloaderId,
      status: this.status,
      triggeredBy: this.triggeredBy,
      error: this.error,
      stats: this.stats,
      startedAt: isoOrNull(this.startedAt),
      finishedAt: isoOrNull(this.finishedAt),
    };
  }
}

export default FetchRun;
