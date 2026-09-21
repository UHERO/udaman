/**
 * Loader for `mls_listings` / `mls_listing_history` (DDL:
 * src/lib/hhdb/mls_listings.sql).
 *
 * UPSERT, not delete + reinsert: `id` and `first_seen_at` stay stable for the
 * life of a listing, and status / price changes are appended to the history
 * table before the row is overwritten.
 *
 * House rules this file is built around:
 *  - DATETIME columns hold Hawaii wall-clock and are only ever stamped with
 *    SQL NOW(). No JS Date is passed as a param, anywhere.
 *  - Column lists are generated from MLS_COLUMNS — never hand-listed — and
 *    every identifier is backtick-quoted (`view`, `security`, `pool`, `status`
 *    are column names).
 *  - Load bugs here historically fail silently, so every write checks
 *    `affectedRows` and throws MlsLoadError rather than report a count it
 *    didn't achieve.
 *
 * The pure builders (buildInsert, buildUpdate, diffListing, …) are separate
 * from the functions that call rawQuery so they can be unit-tested without a
 * database.
 */

import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

import { MLS_COLUMNS, type MlsColumnName, type MlsColumnSpec } from "./columns";
import type {
  ColumnValue,
  ListingStatus,
  MlsBoard,
  NormalizedListing,
} from "./types";

const log = createLogger("mls-load");

// ─── Public types ────────────────────────────────────────────────

export type LoadMeta = {
  /** `source_site` value — SiteAdapter.site. */
  site: string;
  /** SiteAdapter.priority; higher wins. */
  priority: number;
  sourceUrl: string;
  htmlPath: string | null;
};

export type LoadOutcome =
  "inserted" | "updated" | "unchanged" | "skipped_lower_priority";

export type LoadOptions = {
  /**
   * The listing was re-parsed from cached HTML, not fetched: nothing was
   * observed just now. Only `parsed_at` is stamped (last_seen_at / fetched_at
   * keep their values), and no history row is written on the update path —
   * a parser fix that changes a price is not a market event, and observed_at
   * would be the reparse time, not when the site showed it.
   */
  reparse?: boolean;
};

export type KnownListing = {
  mlsBoard: MlsBoard;
  mlsNumber: string;
  status: ListingStatus;
  listPrice: number | null;
  island: string | null;
  /**
   * `fetched_at` exactly as the driver returns it: a Date whose UTC fields
   * carry the Hawaii wall-clock. Format it with formatHst; do not do
   * arithmetic against Date.now() — use daysSinceFetch.
   */
  fetchedAt: Date | null;
  /** TIMESTAMPDIFF(DAY, fetched_at, NOW()), computed in SQL. */
  daysSinceFetch: number | null;
};

export type HistoryChangeType =
  "first_seen" | "status" | "price" | "status+price" | "off_market";

/** The slice of an existing mls_listings row the loader compares against. */
export type ExistingListing = {
  id: number;
  sourcePriority: number;
  status: string;
  statusRaw: string | null;
  /** Stored `extra` JSON text, verbatim. */
  extra: string | null;
  /** Every MLS_COLUMNS column, normalized the same way as new values. */
  fields: Record<MlsColumnName, ColumnValue>;
};

export type ListingDiff = {
  /** Columns whose stored value differs from the incoming one. */
  changedColumns: string[];
  /** History row to append, or null when status and prices are unchanged. */
  changeType: HistoryChangeType | null;
};

export type SqlStatement = { sql: string; params: (string | number | null)[] };

export class MlsLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MlsLoadError";
  }
}

// ─── Constants ───────────────────────────────────────────────────

export const LISTINGS_TABLE = "mls_listings";
export const HISTORY_TABLE = "mls_listing_history";

/** Statuses the pipeline keeps re-checking (getOpenListings). */
export const OPEN_STATUSES: ListingStatus[] = [
  "active",
  "active_under_contract",
  "pending",
];

/** Statuses markOffMarket never overwrites. */
export const TERMINAL_STATUSES: ListingStatus[] = ["off_market", "sold"];

/** Max mls_numbers per IN (...) list in touchSeen. */
export const TOUCH_CHUNK_SIZE = 500;

/**
 * Loader-owned columns written with a param on INSERT and UPDATE, in
 * statement order around the MLS_COLUMNS block. The four DATETIMEs are not
 * here: they are NOW() literals.
 */
const LEADING_COLUMNS = [
  "source_site",
  "source_priority",
  "source_url",
  "status",
  "status_raw",
] as const;
const TRAILING_COLUMNS = ["extra", "html_path"] as const;

const COLUMN_NAME_SET: ReadonlySet<string> = new Set(
  MLS_COLUMNS.map((s) => s.column),
);

// ─── Pure helpers ────────────────────────────────────────────────

/** Backtick-quote an identifier. */
export function q(identifier: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new MlsLoadError(`Unsafe SQL identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}

function isNumericKind(kind: MlsColumnSpec["kind"]): boolean {
  return kind === "int" || kind === "money" || kind === "year";
}

/**
 * Coerce one value — incoming from a parser, or read back from the DB — to
 * the canonical JS form for its column kind, so the two sides of a diff are
 * comparable: numbers for int/money/year (the driver may hand BIGINT back as
 * a string), strings for text/date, null for anything empty or non-finite.
 * Text longer than its VARCHAR is truncated to fit (what gets stored is what
 * gets compared, so a too-long value doesn't read as "changed" every day).
 */
export function normalizeValue(
  spec: MlsColumnSpec,
  value: unknown,
): ColumnValue {
  if (value === null || value === undefined) return null;
  if (isNumericKind(spec.kind)) {
    if (typeof value === "string" && value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  if (spec.kind === "date") {
    if (value instanceof Date) {
      // Driver DATEs are UTC-anchored; only reached if a caller bypasses the
      // DATE_FORMAT in buildSelectExisting.
      return Number.isNaN(value.getTime())
        ? null
        : value.toISOString().slice(0, 10);
    }
    const s = String(value).trim();
    return s === "" ? null : s.slice(0, 10);
  }
  const s = String(value);
  return spec.length !== undefined && s.length > spec.length
    ? s.slice(0, spec.length)
    : s;
}

/**
 * Value for every MLS_COLUMNS column, in order. A column absent from
 * `listing.fields` is NULL — the page is the truth for that fetch.
 * Throws on a key that is not a column: dropping it silently would be exactly
 * the kind of load bug this codebase keeps finding months later.
 */
export function columnValues(listing: NormalizedListing): ColumnValue[] {
  const unknown = Object.keys(listing.fields).filter(
    (k) => !COLUMN_NAME_SET.has(k),
  );
  if (unknown.length > 0) {
    throw new MlsLoadError(
      `${listing.mlsBoard} ${listing.mlsNumber}: fields has keys that are not mls_listings columns: ${unknown.join(", ")}`,
    );
  }
  const fields = listing.fields as Record<string, ColumnValue | undefined>;
  return MLS_COLUMNS.map((spec) => normalizeValue(spec, fields[spec.column]));
}

/** Text columns whose incoming value is longer than its VARCHAR. */
export function truncatedColumns(listing: NormalizedListing): string[] {
  const fields = listing.fields as Record<string, ColumnValue | undefined>;
  return MLS_COLUMNS.filter((spec: MlsColumnSpec) => {
    const v = fields[spec.column];
    return (
      spec.kind === "text" &&
      spec.length !== undefined &&
      typeof v === "string" &&
      v.length > spec.length
    );
  }).map((s) => s.column);
}

/**
 * `extra` as stored: JSON with sorted keys (so key order never reads as a
 * change), or null when there is nothing in it.
 */
export function serializeExtra(
  extra: Record<string, string> | null | undefined,
): string | null {
  if (!extra) return null;
  const keys = Object.keys(extra).sort();
  if (keys.length === 0) return null;
  const sorted: Record<string, string> = {};
  for (const k of keys) sorted[k] = extra[k];
  return JSON.stringify(sorted);
}

/** Canonical form of a stored `extra` string, for comparison only. */
function canonicalExtra(stored: string | null): string | null {
  if (stored === null || stored === "") return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return serializeExtra(parsed as Record<string, string>);
    }
  } catch {
    // fall through — compare verbatim
  }
  return stored;
}

/** Params shared by INSERT and UPDATE, in LEADING / MLS_COLUMNS / TRAILING order. */
function writeParams(
  listing: NormalizedListing,
  meta: LoadMeta,
): (string | number | null)[] {
  return [
    meta.site,
    meta.priority,
    meta.sourceUrl,
    listing.status,
    listing.statusRaw,
    ...columnValues(listing),
    serializeExtra(listing.extra),
    meta.htmlPath,
  ];
}

function writeColumns(): string[] {
  return [
    ...LEADING_COLUMNS,
    ...MLS_COLUMNS.map((s) => s.column),
    ...TRAILING_COLUMNS,
  ];
}

/** INSERT for a listing seen for the first time. All four DATETIMEs = NOW(). */
export function buildInsert(
  listing: NormalizedListing,
  meta: LoadMeta,
): SqlStatement {
  const paramColumns = ["mls_board", "mls_number", ...writeColumns()];
  const nowColumns = [
    "first_seen_at",
    "last_seen_at",
    "fetched_at",
    "parsed_at",
  ];
  const sql =
    `INSERT INTO ${q(LISTINGS_TABLE)} (` +
    [...paramColumns, ...nowColumns].map(q).join(", ") +
    ") VALUES (" +
    [...paramColumns.map(() => "?"), ...nowColumns.map(() => "NOW()")].join(
      ", ",
    ) +
    ")";
  return {
    sql,
    params: [
      listing.mlsBoard,
      listing.mlsNumber,
      ...writeParams(listing, meta),
    ],
  };
}

/**
 * UPDATE of every data column + source / status / extra / html_path.
 * `first_seen_at` is deliberately absent. The `source_priority <= ?` guard
 * re-asserts the priority rule inside the statement, so a higher-priority
 * write that lands between our SELECT and this UPDATE is not clobbered.
 */
export function buildUpdate(
  listing: NormalizedListing,
  meta: LoadMeta,
  opts: LoadOptions = {},
): SqlStatement {
  const nowColumns = opts.reparse
    ? ["parsed_at"]
    : ["last_seen_at", "fetched_at", "parsed_at"];
  const sql =
    `UPDATE ${q(LISTINGS_TABLE)} SET ` +
    [
      ...writeColumns().map((c) => `${q(c)} = ?`),
      ...nowColumns.map((c) => `${q(c)} = NOW()`),
    ].join(", ") +
    ` WHERE ${q("mls_board")} = ? AND ${q("mls_number")} = ? AND ${q("source_priority")} <= ?`;
  return {
    sql,
    params: [
      ...writeParams(listing, meta),
      listing.mlsBoard,
      listing.mlsNumber,
      meta.priority,
    ],
  };
}

/**
 * SELECT of the existing row. DATE columns come back through DATE_FORMAT as
 * 'YYYY-MM-DD' strings so comparing them needs no JS-side timezone handling.
 */
export function buildSelectExisting(
  board: MlsBoard,
  mlsNumber: string,
): SqlStatement {
  const dataCols = MLS_COLUMNS.map((s: MlsColumnSpec) =>
    s.kind === "date"
      ? `DATE_FORMAT(${q(s.column)}, '%Y-%m-%d') AS ${q(s.column)}`
      : q(s.column),
  );
  const sql =
    "SELECT " +
    [
      q("id"),
      q("source_priority"),
      q("status"),
      q("status_raw"),
      q("extra"),
      ...dataCols,
    ].join(", ") +
    ` FROM ${q(LISTINGS_TABLE)} WHERE ${q("mls_board")} = ? AND ${q("mls_number")} = ? LIMIT 1`;
  return { sql, params: [board, mlsNumber] };
}

/** DB row (from buildSelectExisting) → ExistingListing. */
export function rowToExisting(row: Record<string, unknown>): ExistingListing {
  const fields = {} as Record<MlsColumnName, ColumnValue>;
  for (const spec of MLS_COLUMNS) {
    fields[spec.column] = normalizeValue(spec, row[spec.column]);
  }
  return {
    id: Number(row.id),
    sourcePriority: Number(row.source_priority),
    status: String(row.status),
    statusRaw: row.status_raw == null ? null : String(row.status_raw),
    // The driver parses a JSON column into an object; String() of that is
    // "[object Object]", which would read as a change on every load.
    extra:
      row.extra == null
        ? null
        : typeof row.extra === "string"
          ? row.extra
          : JSON.stringify(row.extra),
    fields,
  };
}

/** A history row. `observed_at` = NOW(). */
export function buildHistoryInsert(h: {
  board: MlsBoard;
  mlsNumber: string;
  status: ListingStatus;
  listPrice: number | null;
  soldPrice: number | null;
  site: string;
  changeType: HistoryChangeType;
}): SqlStatement {
  const cols = [
    "mls_board",
    "mls_number",
    "status",
    "list_price",
    "sold_price",
    "source_site",
    "change_type",
  ];
  const sql =
    `INSERT INTO ${q(HISTORY_TABLE)} (` +
    [...cols, "observed_at"].map(q).join(", ") +
    ") VALUES (" +
    [...cols.map(() => "?"), "NOW()"].join(", ") +
    ")";
  return {
    sql,
    params: [
      h.board,
      h.mlsNumber,
      h.status,
      h.listPrice,
      h.soldPrice,
      h.site,
      h.changeType,
    ],
  };
}

/**
 * A copy of `listing` whose status and list price are the stored row's.
 * Sold listings keep the snapshot's values: their final page is the truth.
 */
export function preserveListTracked(
  listing: NormalizedListing,
  existing: ExistingListing,
): NormalizedListing {
  if (listing.status === "sold") return listing;
  return {
    ...listing,
    status: existing.status as ListingStatus,
    statusRaw: existing.statusRaw,
    fields: { ...listing.fields, list_price: existing.fields.list_price },
  };
}

/**
 * A sold page that carries no list price (hres shows one "Price": the closing
 * price) must not erase the asking price we recorded while the listing was
 * open — having both is the point of the two columns.
 */
export function keepListPriceOnSale(
  listing: NormalizedListing,
  existing: ExistingListing,
): NormalizedListing {
  if (
    listing.status !== "sold" ||
    (listing.fields.list_price ?? null) !== null ||
    existing.fields.list_price === null
  ) {
    return listing;
  }
  return {
    ...listing,
    fields: { ...listing.fields, list_price: existing.fields.list_price },
  };
}

/** Which branch of loadListing applies. */
export function decideAction(
  existing: Pick<ExistingListing, "sourcePriority"> | null,
  meta: Pick<LoadMeta, "priority">,
): "insert" | "update" | "skip_lower_priority" {
  if (!existing) return "insert";
  return existing.sourcePriority > meta.priority
    ? "skip_lower_priority"
    : "update";
}

/**
 * Compare the stored row with the incoming listing.
 * `changedColumns` covers status, status_raw, every MLS_COLUMNS column and
 * extra — NOT source_site / source_url / html_path / the timestamps, which
 * change on every fetch without the listing itself changing.
 */
export function diffListing(
  existing: ExistingListing,
  listing: NormalizedListing,
): ListingDiff {
  const changedColumns: string[] = [];
  if (existing.status !== listing.status) changedColumns.push("status");
  if ((existing.statusRaw ?? null) !== (listing.statusRaw ?? null))
    changedColumns.push("status_raw");

  const incoming = columnValues(listing);
  MLS_COLUMNS.forEach((spec: MlsColumnSpec, i) => {
    const old = normalizeValue(
      spec,
      existing.fields[spec.column as MlsColumnName],
    );
    if (old !== incoming[i]) changedColumns.push(spec.column);
  });

  if (canonicalExtra(existing.extra) !== serializeExtra(listing.extra))
    changedColumns.push("extra");

  const statusChanged = changedColumns.includes("status");
  const priceChanged =
    changedColumns.includes("list_price") ||
    changedColumns.includes("sold_price");
  const changeType: HistoryChangeType | null =
    statusChanged && priceChanged
      ? "status+price"
      : statusChanged
        ? "status"
        : priceChanged
          ? "price"
          : null;
  return { changedColumns, changeType };
}

/** Split into chunks of at most `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

/** `last_seen_at = NOW()` for one chunk of numbers. */
export function buildTouchSeen(
  board: MlsBoard,
  mlsNumbers: string[],
): SqlStatement {
  if (mlsNumbers.length === 0 || mlsNumbers.length > TOUCH_CHUNK_SIZE) {
    throw new MlsLoadError(
      `buildTouchSeen: chunk of ${mlsNumbers.length} (must be 1..${TOUCH_CHUNK_SIZE})`,
    );
  }
  return {
    sql:
      `UPDATE ${q(LISTINGS_TABLE)} SET ${q("last_seen_at")} = NOW() ` +
      `WHERE ${q("mls_board")} = ? AND ${q("mls_number")} IN (${mlsNumbers.map(() => "?").join(", ")})`,
    params: [board, ...mlsNumbers],
  };
}

// ─── DB access ───────────────────────────────────────────────────

type WriteResult = unknown[] & { affectedRows?: number };

/**
 * Run a write and return affectedRows. Throws if the driver didn't report
 * one — treating "unknown" as 0 or 1 is how counts end up lying.
 */
async function execWrite(stmt: SqlStatement): Promise<number> {
  const result = (await rawQuery(stmt.sql, stmt.params)) as WriteResult;
  const n = result.affectedRows;
  if (typeof n !== "number") {
    throw new MlsLoadError(
      `Driver returned no affectedRows for: ${stmt.sql.slice(0, 60)}…`,
    );
  }
  return n;
}

function isDuplicateKeyError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & { code?: string; errno?: number };
  return (
    e.code === "ER_DUP_ENTRY" ||
    e.errno === 1062 ||
    /duplicate entry/i.test(e.message)
  );
}

async function selectExisting(
  board: MlsBoard,
  mlsNumber: string,
): Promise<ExistingListing | null> {
  const stmt = buildSelectExisting(board, mlsNumber);
  const rows = await rawQuery<Record<string, unknown>>(stmt.sql, stmt.params);
  return rows.length > 0 ? rowToExisting(rows[0]) : null;
}

async function insertHistory(
  h: Parameters<typeof buildHistoryInsert>[0],
): Promise<void> {
  const n = await execWrite(buildHistoryInsert(h));
  if (n !== 1) {
    throw new MlsLoadError(
      `${h.board} ${h.mlsNumber}: history insert (${h.changeType}) affected ${n} rows, expected 1`,
    );
  }
}

/** Bump last_seen_at on one row. 0 affected is fine: same-second re-touch. */
async function touchOne(board: MlsBoard, mlsNumber: string): Promise<void> {
  await execWrite(buildTouchSeen(board, [mlsNumber]));
}

function priceOf(
  listing: NormalizedListing,
  column: "list_price" | "sold_price",
): number | null {
  const spec = MLS_COLUMNS.find((s) => s.column === column) as MlsColumnSpec;
  return normalizeValue(spec, listing.fields[column]) as number | null;
}

/**
 * Upsert one parsed listing.
 *
 * Write order. UPDATE path: history row first, then the row itself. The two
 * statements can't share a transaction through rawQuery, so one can succeed
 * without the other; history-first means the failure mode is a duplicate
 * history row on the next run (harmless, visible) rather than a status/price
 * change that is never recorded because the row already matches.
 * INSERT path: row first (the unique key arbitrates a concurrent insert), then
 * the `first_seen` history row — which is recoverable from first_seen_at if
 * it is ever lost.
 */
export async function loadListing(
  listing: NormalizedListing,
  meta: LoadMeta,
  opts: LoadOptions = {},
): Promise<LoadOutcome> {
  return loadListingOnce(listing, meta, opts, true);
}

async function loadListingOnce(
  listing: NormalizedListing,
  meta: LoadMeta,
  opts: LoadOptions,
  retryOnDuplicate: boolean,
): Promise<LoadOutcome> {
  const { mlsBoard: board, mlsNumber } = listing;
  if (!board || !mlsNumber) {
    throw new MlsLoadError(
      `Listing without a (board, number) key: ${board}/${mlsNumber}`,
    );
  }

  const truncated = truncatedColumns(listing);
  if (truncated.length > 0) {
    log.warn(
      { board, mlsNumber, columns: truncated },
      "mls value longer than its VARCHAR — truncated",
    );
  }

  const existing = await selectExisting(board, mlsNumber);
  const action = decideAction(existing, meta);

  if (action === "insert") {
    let inserted: number;
    try {
      inserted = await execWrite(buildInsert(listing, meta));
    } catch (err) {
      if (retryOnDuplicate && isDuplicateKeyError(err)) {
        log.warn(
          { board, mlsNumber },
          "mls insert raced another writer — retrying as update",
        );
        return loadListingOnce(listing, meta, opts, false);
      }
      throw err;
    }
    if (inserted !== 1) {
      throw new MlsLoadError(
        `${board} ${mlsNumber}: insert affected ${inserted} rows, expected 1`,
      );
    }
    await insertHistory({
      board,
      mlsNumber,
      status: listing.status,
      listPrice: priceOf(listing, "list_price"),
      soldPrice: priceOf(listing, "sold_price"),
      site: meta.site,
      changeType: "first_seen",
    });
    return "inserted";
  }

  if (action === "skip_lower_priority") {
    if (!opts.reparse) await touchOne(board, mlsNumber);
    return "skipped_lower_priority";
  }

  listing = keepListPriceOnSale(listing, existing as ExistingListing);

  if (opts.reparse) {
    // The daily run keeps status and list price current from list rows
    // (applyListChange) without re-fetching the page, so the stored values can
    // be newer than the snapshot being reparsed. Keep them.
    listing = preserveListTracked(listing, existing as ExistingListing);
  }

  const diff = diffListing(existing as ExistingListing, listing);
  if (diff.changeType && !opts.reparse) {
    await insertHistory({
      board,
      mlsNumber,
      status: listing.status,
      listPrice: priceOf(listing, "list_price"),
      soldPrice: priceOf(listing, "sold_price"),
      site: meta.site,
      changeType: diff.changeType,
    });
  }

  const affected = await execWrite(buildUpdate(listing, meta, opts));
  // affectedRows counts CHANGED rows. With nothing differing, 0 is legitimate
  // (same-second reload: even NOW() matches). With a real difference, 0 means
  // the row vanished or a higher-priority writer got in — not an update.
  if (diff.changedColumns.length > 0 && affected !== 1) {
    throw new MlsLoadError(
      `${board} ${mlsNumber}: update affected ${affected} rows with ${diff.changedColumns.length} changed columns (${diff.changedColumns.slice(0, 5).join(", ")})`,
    );
  }
  if (diff.changedColumns.length > 0) {
    log.debug(
      {
        board,
        mlsNumber,
        changed: diff.changedColumns,
        changeType: diff.changeType,
      },
      "mls listing updated",
    );
    return "updated";
  }
  return "unchanged";
}

/**
 * Bump last_seen_at = NOW() for listings a list page showed.
 * Returns the sum of affectedRows, i.e. rows whose last_seen_at actually
 * moved. That is ≤ the number of known listings in `mlsNumbers`: numbers not
 * in the table match nothing, and a row already touched in the same second
 * does not count (MariaDB reports changed rows, not matched rows).
 */
export async function touchSeen(
  board: MlsBoard,
  mlsNumbers: string[],
): Promise<number> {
  const unique = [...new Set(mlsNumbers)];
  let touched = 0;
  for (const part of chunk(unique, TOUCH_CHUNK_SIZE)) {
    touched += await execWrite(buildTouchSeen(board, part));
  }
  return touched;
}

/**
 * The site no longer serves the listing: status → 'off_market' + a history
 * row. Returns false (and writes nothing) when the listing is unknown, already
 * off_market / sold, or owned by a different source_site — a site dropping a
 * listing says nothing about a row another, higher-priority site wrote.
 * last_seen_at is NOT bumped: we did not see it.
 */
export async function markOffMarket(
  board: MlsBoard,
  mlsNumber: string,
  site: string,
): Promise<boolean> {
  const rows = await rawQuery<Record<string, unknown>>(
    `SELECT ${q("status")}, ${q("source_site")}, ${q("list_price")}, ${q("sold_price")} ` +
      `FROM ${q(LISTINGS_TABLE)} WHERE ${q("mls_board")} = ? AND ${q("mls_number")} = ? LIMIT 1`,
    [board, mlsNumber],
  );
  if (rows.length === 0) {
    log.warn({ board, mlsNumber, site }, "markOffMarket: no such listing");
    return false;
  }
  const row = rows[0];
  const status = String(row.status);
  if ((TERMINAL_STATUSES as string[]).includes(status)) return false;
  if (String(row.source_site) !== site) {
    log.warn(
      { board, mlsNumber, site, owner: row.source_site },
      "markOffMarket: row owned by another site — skipped",
    );
    return false;
  }

  const money = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  // History first — see loadListing for why.
  await insertHistory({
    board,
    mlsNumber,
    status: "off_market",
    listPrice: money(row.list_price),
    soldPrice: money(row.sold_price),
    site,
    changeType: "off_market",
  });

  const terminal = TERMINAL_STATUSES.map(() => "?").join(", ");
  const affected = await execWrite({
    sql:
      `UPDATE ${q(LISTINGS_TABLE)} SET ${q("status")} = ? ` +
      `WHERE ${q("mls_board")} = ? AND ${q("mls_number")} = ? AND ${q("source_site")} = ? ` +
      `AND ${q("status")} NOT IN (${terminal})`,
    params: ["off_market", board, mlsNumber, site, ...TERMINAL_STATUSES],
  });
  if (affected !== 1) {
    throw new MlsLoadError(
      `${board} ${mlsNumber}: off_market update affected ${affected} rows, expected 1 (history row already written)`,
    );
  }
  return true;
}

/**
 * Record a status and/or list-price change seen on a LIST row, without
 * fetching the detail page: one history row + an in-place update. The daily
 * run uses this for listings already on file — the property characteristics
 * we keep the page for don't change, so there is nothing to re-fetch.
 * No-op (false) when nothing differs, the row is closed, or another site owns it.
 */
export async function applyListChange(
  board: MlsBoard,
  mlsNumber: string,
  site: string,
  seen: { status?: ListingStatus; listPrice?: number | null },
): Promise<boolean> {
  const rows = await rawQuery<Record<string, unknown>>(
    `SELECT ${q("status")}, ${q("source_site")}, ${q("list_price")}, ${q("sold_price")} ` +
      `FROM ${q(LISTINGS_TABLE)} WHERE ${q("mls_board")} = ? AND ${q("mls_number")} = ? LIMIT 1`,
    [board, mlsNumber],
  );
  const row = rows[0];
  if (!row || String(row.source_site) !== site) return false;
  const oldStatus = String(row.status) as ListingStatus;
  if ((TERMINAL_STATUSES as string[]).includes(oldStatus)) return false;

  const num = (v: unknown): number | null =>
    v === null || v === undefined || !Number.isFinite(Number(v))
      ? null
      : Number(v);
  const oldPrice = num(row.list_price);
  const status =
    seen.status && seen.status !== "unknown" ? seen.status : oldStatus;
  const listPrice =
    seen.listPrice === undefined || seen.listPrice === null
      ? oldPrice
      : seen.listPrice;
  const statusChanged = status !== oldStatus;
  const priceChanged = listPrice !== oldPrice;
  if (!statusChanged && !priceChanged) return false;

  // History first — see loadListing for why.
  await insertHistory({
    board,
    mlsNumber,
    status,
    listPrice,
    soldPrice: num(row.sold_price),
    site,
    changeType:
      statusChanged && priceChanged
        ? "status+price"
        : statusChanged
          ? "status"
          : "price",
  });
  const affected = await execWrite({
    sql:
      `UPDATE ${q(LISTINGS_TABLE)} SET ${q("status")} = ?, ${q("list_price")} = ?, ${q("last_seen_at")} = NOW() ` +
      `WHERE ${q("mls_board")} = ? AND ${q("mls_number")} = ? AND ${q("source_site")} = ?`,
    params: [status, listPrice, board, mlsNumber, site],
  });
  if (affected !== 1) {
    throw new MlsLoadError(
      `${board} ${mlsNumber}: list-row update affected ${affected} rows, expected 1 (history row already written)`,
    );
  }
  return true;
}

/**
 * DATETIME as the driver's UTC-anchored Date. A naive 'YYYY-MM-DD HH:MM:SS'
 * string is anchored the same way (never parsed in the machine's local zone).
 */
function toWallClockDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  const d = new Date(
    /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(" ", "T")}Z`,
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Listings `site` owns that are still on the market, for the recheck walk. */
export async function getOpenListings(site: string): Promise<KnownListing[]> {
  const open = OPEN_STATUSES.map(() => "?").join(", ");
  const rows = await rawQuery<Record<string, unknown>>(
    `SELECT ${q("mls_board")}, ${q("mls_number")}, ${q("status")}, ${q("list_price")}, ${q("island")}, ` +
      `${q("fetched_at")}, TIMESTAMPDIFF(DAY, ${q("fetched_at")}, NOW()) AS ${q("days_since_fetch")} ` +
      `FROM ${q(LISTINGS_TABLE)} WHERE ${q("source_site")} = ? AND ${q("status")} IN (${open}) ` +
      `ORDER BY ${q("mls_board")}, ${q("mls_number")}`,
    [site, ...OPEN_STATUSES],
  );
  return rows.map((r) => ({
    mlsBoard: String(r.mls_board) as MlsBoard,
    mlsNumber: String(r.mls_number),
    status: String(r.status) as ListingStatus,
    listPrice: r.list_price == null ? null : Number(r.list_price),
    island: r.island == null ? null : String(r.island),
    fetchedAt: toWallClockDate(r.fetched_at),
    daysSinceFetch:
      r.days_since_fetch == null ? null : Number(r.days_since_fetch),
  }));
}

export type ListingOwner = {
  site: string;
  priority: number;
  status: ListingStatus;
};

/** `${board}:${number}` — how the pipeline keys listings across boards. */
export function listingKey(board: MlsBoard, mlsNumber: string): string {
  return `${board}:${mlsNumber}`;
}

/**
 * Who owns every listing already in the table for these boards (any status,
 * any site), keyed by listingKey(). A site uses this to skip the detail
 * fetch for a listing a higher-priority site already maintains.
 */
export async function getKnownListings(
  boards: MlsBoard[],
): Promise<Map<string, ListingOwner>> {
  if (boards.length === 0) return new Map();
  const rows = await rawQuery<Record<string, unknown>>(
    `SELECT ${q("mls_board")}, ${q("mls_number")}, ${q("source_site")}, ${q("source_priority")}, ${q("status")} ` +
      `FROM ${q(LISTINGS_TABLE)} WHERE ${q("mls_board")} IN (${boards.map(() => "?").join(", ")})`,
    boards,
  );
  return new Map(
    rows.map((r) => [
      listingKey(String(r.mls_board) as MlsBoard, String(r.mls_number)),
      {
        site: String(r.source_site),
        priority: Number(r.source_priority),
        status: String(r.status) as ListingStatus,
      },
    ]),
  );
}
