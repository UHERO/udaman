import { isAbsolute, join, normalize, sep } from "node:path";

import { getDataDir } from "@/lib/data-dir";

import { isoOrNull, jsonArray, jsonObject, toDate } from "./ingest-columns";

export const EXTRACTION_RUN_STATUSES = [
  "running",
  "ok",
  "unchanged",
  "failed",
] as const;
/** unchanged = same inputs_hash as the last ok run; parse skipped. */
export type ExtractionRunStatus = (typeof EXTRACTION_RUN_STATUSES)[number];

/**
 * One validation check's outcome. A `hard` failure (columns, duplicates,
 * non-numeric values, dates) can never be published; a run whose only
 * failures are `soft` (disappeared series, large jumps) can be accepted.
 */
export type ValidationResult = {
  check: string;
  severity: "hard" | "soft";
  passed: boolean;
  message: string;
  /** A bounded sample of offending rows / series, for display */
  details?: unknown[];
};

export type ExtractionRunAttrs = {
  id: number;
  extractor_id: number;
  status: string;
  triggered_by?: string | null;
  fetch_run_id?: number | null;
  input_artifact_ids?: unknown;
  inputs_hash?: string | null;
  error?: string | null;
  validation_results?: unknown;
  stats?: unknown;
  output_path?: string | null;
  output_hash?: string | null;
  row_count?: number | null;
  series_count?: number | null;
  accepted_by?: number | null;
  accepted_at?: Date | string | null;
  started_at: Date | string;
  finished_at?: Date | string | null;
};

export type SerializedExtractionRun = ReturnType<ExtractionRun["toJSON"]>;

/**
 * One parse attempt of a DataExtractor. Loads read the output of the
 * extractor's latest run with status "ok".
 */
class ExtractionRun {
  readonly id: number;
  extractorId: number;
  status: ExtractionRunStatus;
  triggeredBy: string | null;
  fetchRunId: number | null;
  inputArtifactIds: number[];
  /** sha256 over input content hashes, extractor config and parser version */
  inputsHash: string | null;
  error: string | null;
  validationResults: ValidationResult[];
  /** Counts the parser reported (files parsed, months covered, ...) */
  stats: Record<string, unknown>;
  /** Relative to DATA_DIR */
  outputPath: string | null;
  outputHash: string | null;
  rowCount: number | null;
  seriesCount: number | null;
  acceptedBy: number | null;
  acceptedAt: Date | null;
  startedAt: Date;
  finishedAt: Date | null;

  constructor(attrs: ExtractionRunAttrs) {
    this.id = attrs.id;
    this.extractorId = attrs.extractor_id;
    this.status = (EXTRACTION_RUN_STATUSES as readonly string[]).includes(
      attrs.status,
    )
      ? (attrs.status as ExtractionRunStatus)
      : "failed";
    this.triggeredBy = attrs.triggered_by ?? null;
    this.fetchRunId = attrs.fetch_run_id ?? null;
    this.inputArtifactIds = jsonArray(attrs.input_artifact_ids).map(Number);
    this.inputsHash = attrs.inputs_hash ?? null;
    this.error = attrs.error ?? null;
    this.validationResults = jsonArray<ValidationResult>(
      attrs.validation_results,
    );
    this.stats = jsonObject(attrs.stats);
    this.outputPath = attrs.output_path ?? null;
    this.outputHash = attrs.output_hash ?? null;
    this.rowCount = attrs.row_count ?? null;
    this.seriesCount = attrs.series_count ?? null;
    this.acceptedBy = attrs.accepted_by ?? null;
    this.acceptedAt = toDate(attrs.accepted_at);
    this.startedAt = toDate(attrs.started_at)!;
    this.finishedAt = toDate(attrs.finished_at);
  }

  /** Failed checks, hard ones first. */
  failedChecks(): ValidationResult[] {
    return this.validationResults
      .filter((r) => !r.passed)
      .sort((a, b) =>
        a.severity === b.severity ? 0 : a.severity === "hard" ? -1 : 1,
      );
  }

  /**
   * A failed run can be accepted when it got as far as writing an output
   * and every failed check is soft. A parse exception (no validation
   * results) or any hard failure cannot be accepted.
   */
  canAccept(): boolean {
    if (this.status !== "failed" || !this.outputPath) return false;
    const failed = this.failedChecks();
    return failed.length > 0 && failed.every((r) => r.severity === "soft");
  }

  /** Absolute path of the output CSV, confined to DATA_DIR. */
  outputAbsolutePath(): string | null {
    if (!this.outputPath) return null;
    const rel = normalize(this.outputPath);
    if (isAbsolute(rel) || rel.startsWith(`..${sep}`) || rel === "..") {
      throw new Error(
        `ExtractionRun#${this.id}: output_path escapes DATA_DIR: ${this.outputPath}`,
      );
    }
    return join(/*turbopackIgnore: true*/ getDataDir(), rel);
  }

  toString(): string {
    return `ExtractionRun#${this.id} <${this.status}>`;
  }

  toJSON() {
    return {
      id: this.id,
      extractorId: this.extractorId,
      status: this.status,
      triggeredBy: this.triggeredBy,
      fetchRunId: this.fetchRunId,
      inputArtifactIds: this.inputArtifactIds,
      inputsHash: this.inputsHash,
      error: this.error,
      validationResults: this.validationResults,
      stats: this.stats,
      outputPath: this.outputPath,
      outputHash: this.outputHash,
      rowCount: this.rowCount,
      seriesCount: this.seriesCount,
      acceptedBy: this.acceptedBy,
      acceptedAt: isoOrNull(this.acceptedAt),
      startedAt: isoOrNull(this.startedAt),
      finishedAt: isoOrNull(this.finishedAt),
    };
  }
}

export default ExtractionRun;
