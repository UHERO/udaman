import type Downloader from "@catalog/models/downloader";

import type { SourceHelpers } from "./sources";

/** One observation in a downloader's output file. */
export type TidyRow = {
  /**
   * The row's key columns joined with KEY_SEP ("|"), e.g. a BLS series id,
   * or `collec|Income-Ind.|Refunds|State` for DOTAX
   */
  key: string;
  /** YYYY-MM-DD, period start */
  date: string;
  /** Raw, unscaled value (the loader's scale still applies) */
  value: number;
  /** One-letter frequency code (A/S/Q/M/W/D) */
  freq?: string;
  /** Other columns of the layout (e.g. fiscal_year), as text */
  extra?: Record<string, string>;
};

/**
 * Columns of a downloader's output CSV. The default is
 * `key,date,value,freq`; DOTAX writes the source's own shape,
 * `date,type,tax,source,area,amount,fiscal_year`.
 */
export type OutputLayout = {
  /** Header, in file order. Includes "date" and the value column. */
  columns: readonly string[];
  /** Columns that identify a series; joined with "|" they are TidyRow.key */
  keyColumns: readonly string[];
  /** Column holding the number */
  valueColumn: string;
  /** Column holding the one-letter frequency, if the layout has one */
  freqColumn?: string;
};

export type OutputWrite =
  /** The output becomes exactly these rows. */
  | { mode: "replace"; rows: TidyRow[] }
  /**
   * Keys in `rows` replace their old rows (from `replaceFrom[key]` on, or
   * entirely when absent); keys not in `rows` keep theirs. A failed batch
   * or a keyed run therefore never deletes data.
   */
  | {
      mode: "merge";
      rows: TidyRow[];
      replaceFrom?: Record<string, string>;
    };

/** Resolved load-method arguments. */
export type ResolvedKey = {
  key: string;
  /** Expected frequency code; reading checks it against the stored rows. */
  frequency?: string;
  /** Human-readable form for error messages */
  label: string;
};

export type DownloaderRunResult = {
  /** null = nothing to write (e.g. sources unchanged, parse skipped) */
  write: OutputWrite | null;
  failedKeys?: string[];
  /** Fatal-to-the-output problems (e.g. unwaived DOTAX check failures). */
  error?: string;
  stats?: Record<string, unknown>;
};

export interface DownloaderContext {
  downloader: Downloader;
  /** Keyed run: only these keys. null = a normal run. */
  keys: string[] | null;
  /** Ignore source TTLs / skip-if-unchanged shortcuts (historical still skipped). */
  force: boolean;
  /** Ignore historical marks and history state: refetch everything. */
  full: boolean;
  /** DATA_DIR/downloaders/<handle>/ — created before run() */
  cacheDir: string;
  /** Keys referenced by enabled load statements that call this downloader's load method. */
  referencedKeys(): Promise<string[]>;
  /** Patch the implementation-owned state; persisted when the run finishes. */
  setState(patch: Record<string, unknown>): void;
  sources: SourceHelpers;
  log(msg: string): void;
}

export interface DownloaderImpl {
  /** Matches downloaders.handle */
  handle: string;
  /** Ruby eval verb, e.g. "load_from_bls_api" */
  loadMethod: string;
  /** Short description of the load-method arguments, for the UI */
  loadSignature: string;
  /** Output Download handle */
  outputHandle: string;
  /** Load-method arguments → internal key. Throws with a helpful message on bad args. */
  keyFromArgs(args: unknown[]): ResolvedKey;
  /** Output columns (default DEFAULT_LAYOUT: key,date,value,freq) */
  layout?: OutputLayout;
  /**
   * An output row's key → the key keyFromArgs returns for it, when the two
   * differ (DOTAX rows carry labels as printed; lookups go through the
   * label rules). null = the row cannot be addressed. Default: identity.
   */
  indexKey?(rowKey: string): string | null;
  /** false → a keyed run is just a normal run (scrapers parse every file anyway). */
  supportsKeyedRuns: boolean;
  run(ctx: DownloaderContext): Promise<DownloaderRunResult>;
}
