/**
 * The source-module contract for data ingest. See
 * docs/2026-10-14-downloaders-extractors-spec.md.
 *
 *   Acquire  DataDownloader  fetch raw files, store them unchanged
 *   Extract  DataExtractor   parse stored raw files → long CSV, validate
 *   Load     load statement  Series.load_from_extract("handle", { dim: "label" })
 *
 * A source module holds the code for one source (or one reusable parser);
 * data_downloaders / data_extractors rows point at it by `source_key` and
 * carry the config. The framework (src/core/ingest/run.ts) does
 * everything else: claiming, storing and hashing, run records, skipping
 * unchanged inputs, validation and writing the output.
 */

import type DataDownloader from "@catalog/models/data-downloader";
import type DataExtractor from "@catalog/models/data-extractor";
import type { ValidationResult } from "@catalog/models/extraction-run";
import type RawArtifact from "@catalog/models/raw-artifact";
import type { HTMLElement } from "node-html-parser";

export type { ValidationResult };

/**
 * One observation of an extract. `dims` holds exactly the extractor's
 * declared dimensions, as the source labels them (lightly normalized, and
 * aliased to one fixed spelling per series where the source relabels). A
 * dimension named `frequency` holds a one-letter code (A/S/Q/M/W/D).
 */
export type ExtractRow = {
  dims: Record<string, string>;
  /** Period start, YYYY-MM-DD (the Series date convention) */
  date: string;
  value: number;
};

/** A stored raw file handed to parse(). */
export type ParseInput = {
  artifact: RawArtifact;
  /** Absolute path of the stored bytes */
  path: string;
  /** Handle of the downloader that stored it */
  downloaderHandle: string;
  /** The extractor_inputs role of that downloader, if any */
  role: string | null;
};

export interface ParseContext {
  extractor: DataExtractor;
  log(msg: string): void;
}

/** What a fetch stored for one artifact key. */
export type StoredArtifact = {
  artifact: RawArtifact;
  /** New vintage of this key (vs. the key's newest vintage before the fetch) */
  changed: boolean;
};

export type StoreInfo = {
  resolvedUrl?: string | null;
  originalName?: string | null;
  contentType?: string | null;
  /** Navigation facts (page title, revision note, ...) — never data values */
  metadata?: Record<string, unknown> | null;
  /** The source will not change this key again: never refetch it */
  final?: boolean;
};

/**
 * Handed to a source module's fetch() (strategy "custom"). Fetch may read
 * pages to find the data (navigation) but never pulls values out: every
 * file it wants parsed goes through store() / download().
 */
export interface FetchContext {
  downloader: DataDownloader;
  /** Refetch keys even when a shortcut says nothing changed */
  force: boolean;
  /** Also refetch keys marked final */
  full: boolean;
  /** GET with the UDAMAN user agent and a timeout; throws on non-2xx. */
  get(url: string, init?: RequestInit): Promise<Response>;
  /** GET an HTML page and parse it. */
  getPage(url: string): Promise<HTMLElement>;
  /** Store bytes as the newest vintage of `artifactKey` (deduped by hash). */
  store(
    artifactKey: string,
    bytes: Uint8Array,
    info?: StoreInfo,
  ): Promise<StoredArtifact>;
  /** GET `url` and store the body; refuses an HTML page passed off as a data file. */
  download(
    url: string,
    artifactKey: string,
    info?: Omit<StoreInfo, "resolvedUrl" | "contentType">,
  ): Promise<StoredArtifact>;
  /** Newest stored vintage of a key, or null. */
  latest(artifactKey: string): Promise<RawArtifact | null>;
  /** Keys whose newest vintage is final (skip them unless `full`). */
  finalKeys(): Promise<Set<string>>;
  markFinal(artifactKey: string): Promise<void>;
  /**
   * Filters of the enabled load statements that read an extractor fed by
   * this downloader, e.g. [{ series_id: "CUSR0000SA0" }] — for sources
   * whose fetch list comes from the load statements (BLS).
   */
  referencedFilters(): Promise<Array<Record<string, string>>>;
  /** Implementation-owned state from the last run; persisted on success. */
  state: Record<string, unknown>;
  setState(patch: Record<string, unknown>): void;
  /**
   * A key could not be fetched (HTTP error, unreadable response). The run
   * keeps going so other keys are stored, but it is recorded as failed and
   * does not trigger extraction.
   */
  keyFailed(artifactKey: string, message: string): void;
  /** Something worth showing that is not a failure (recorded in the run's stats). */
  warn(message: string): void;
  sleep(ms: number): Promise<void>;
  log(msg: string): void;
}

/**
 * Why a series has no value for a period between its first and last
 * value. A published extract only ever has these three:
 *   blank   the source printed the row with no value (no data)
 *   absent  the source's file for the period was read, but the row is
 *           not in it (not reported)
 *   failed  the period could not be read (file missing, unreadable, ...)
 *           and a known issue waived the failure — otherwise the run fails
 */
export type MissingReason = "blank" | "absent" | "failed";

export type MissingPeriod = {
  dims: Record<string, string>;
  /** YYYY-MM-DD, period start */
  date: string;
  reason: MissingReason;
  /** e.g. the waived failure and its note */
  detail?: string;
};

/** What parse() returns. */
export type ParseResult = {
  rows: ExtractRow[];
  /**
   * Periods inside a series' range with no value, and why; written next
   * to the extract (<run id>.missing.csv) so a hole can be told apart
   * from a failure.
   */
  missing?: MissingPeriod[];
  /**
   * The source's own checks (sums, unknown labels, missing files, ...),
   * recorded with the framework's checks; any failed one fails the run.
   */
  checks?: ValidationResult[];
  /** Counts worth showing (files parsed, months covered, ...) */
  stats?: Record<string, unknown>;
};

export interface SourceModule {
  /** Registry key (= source_key on data_downloaders / data_extractors) */
  key: string;
  description: string;
  /**
   * Parser version. Bump it whenever the same raw files would parse
   * differently (code or bundled config change): it is part of the
   * inputs hash, so a bump forces a re-parse.
   */
  version: number;

  /** Acquire, for downloaders with strategy "custom". */
  fetch?(ctx: FetchContext): Promise<void>;

  /**
   * One-letter frequency of every series, for sources without a
   * `frequency` dimension (DOTAX: "M"). Checked against the target
   * series' name at load time.
   */
  frequency?: string;
  /**
   * The fetch list comes from the load statements (BLS): at save time a
   * filter matching nothing yet is a warning (it will be fetched), not an
   * error.
   */
  fetchesReferencedFilters?: boolean;

  /** Declared dimension columns of an extractor's output, in order. */
  dimensions(extractor: DataExtractor): readonly string[];
  /**
   * Which stored vintages parse() receives: "latest" (default) = the
   * newest vintage of every key; "all" = every retained vintage, oldest
   * first per key (sources that merge incremental responses, e.g. BLS).
   */
  inputVintages?: "latest" | "all";
  /**
   * Extract: a pure function of the stored files. No network. Throwing
   * fails the run without an output; failed `checks` fail it with one.
   */
  parse(
    inputs: readonly ParseInput[],
    ctx: ParseContext,
  ): Promise<ParseResult> | ParseResult;
}
