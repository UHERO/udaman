/**
 * SQL generation for the delta load.
 *
 * Kept free of I/O so the statements can be inspected and tested directly —
 * the whole point of this module is that a handful of set-based statements
 * reproduce what qpub-load.ts does with tens of round trips per parcel, and
 * that equivalence is only trustworthy if it's checkable.
 */

import {
  DELTA_STRATEGY,
  NON_COMPARED_COLUMNS,
  type DeltaStrategy,
} from "./qpub-delta-strategy";

/** Prefix for the throwaway tables this load creates. */
export const STAGING_PREFIX = "_qpub_stg_";
export const LATEST_PREFIX = "_qpub_latest_";

export type ColumnMeta = {
  name: string;
  /**
   * True for CHAR/VARCHAR/TEXT/ENUM. Text columns are compared with
   * TRIM + NULL→'' to match normalizeForCompare() in qpub-load.ts; everything
   * else uses null-safe equality on the native type, which is both cheaper and
   * more accurate than round-tripping numbers through strings.
   */
  isText: boolean;
};

export type TableMeta = {
  table: string;
  columns: ColumnMeta[];
};

// ─── Identifier + comparison helpers ────────────────────────────────

/** `usage` is reserved; quoting everything is simpler than special-casing. */
function q(identifier: string): string {
  return `\`${identifier}\``;
}

export function stagingTable(table: string): string {
  return `${STAGING_PREFIX}${table}`;
}

export function latestTable(table: string): string {
  return `${LATEST_PREFIX}${table}`;
}

/**
 * Null-safe equality between the same column on two aliases.
 *
 * Text uses TRIM + COALESCE so it agrees with normalizeForCompare(), which
 * treats NULL, "" and " " as the same value. Anything else uses `<=>`.
 */
function columnsEqual(
  left: string,
  right: string,
  col: ColumnMeta,
): string {
  const l = `${left}.${q(col.name)}`;
  const r = `${right}.${q(col.name)}`;
  return col.isText
    ? `COALESCE(TRIM(${l}), '') = COALESCE(TRIM(${r}), '')`
    : `${l} <=> ${r}`;
}

function allEqual(
  left: string,
  right: string,
  cols: ColumnMeta[],
): string {
  if (cols.length === 0) return "1=1";
  return cols.map((c) => columnsEqual(left, right, c)).join("\n       AND ");
}

function pick(meta: TableMeta, names: string[]): ColumnMeta[] {
  return names
    .map((n) => meta.columns.find((c) => c.name === n))
    .filter((c): c is ColumnMeta => c !== undefined);
}

/** Columns the staging table carries — everything except the surrogate key. */
export function stagingColumns(meta: TableMeta): ColumnMeta[] {
  return meta.columns.filter((c) => c.name !== "id" && c.name !== "created_at");
}

/**
 * Columns that participate in change detection: everything that isn't a
 * surrogate key, a DB-managed timestamp, or part of the identity.
 */
export function dataColumns(
  meta: TableMeta,
  identity: string[],
): ColumnMeta[] {
  const ident = new Set(identity);
  return meta.columns.filter(
    (c) => !NON_COMPARED_COLUMNS.has(c.name) && !ident.has(c.name),
  );
}

// ─── Statement builders ─────────────────────────────────────────────

export function createStagingSql(meta: TableMeta): string[] {
  const stg = stagingTable(meta.table);
  const cols = stagingColumns(meta)
    .map((c) => c.name)
    .map(q)
    .join(", ");
  return [
    `DROP TABLE IF EXISTS ${q(stg)}`,
    // LIKE copies indexes and the AUTO_INCREMENT flag; both are dead weight
    // for a write-once scratch table, so the shape is taken from a SELECT and
    // one index is added for the joins that follow.
    `CREATE TABLE ${q(stg)} AS SELECT ${cols} FROM ${q(meta.table)} WHERE 1=0`,
    `ALTER TABLE ${q(stg)} ADD INDEX idx_stg_tmk (tmk)`,
  ];
}

export function dropStagingSql(table: string): string[] {
  return [
    `DROP TABLE IF EXISTS ${q(stagingTable(table))}`,
    `DROP TABLE IF EXISTS ${q(latestTable(table))}`,
  ];
}

/** INSERT ... ON DUPLICATE KEY UPDATE — the database does the matching. */
function upsertKeySql(meta: TableMeta, key: string[]): string[] {
  const stg = stagingTable(meta.table);
  const insertCols = stagingColumns(meta);
  const colList = insertCols.map((c) => q(c.name)).join(", ");

  const keySet = new Set(key);
  const updates = insertCols
    .filter((c) => !keySet.has(c.name) && c.name !== "created_at")
    .map((c) => `${q(c.name)} = VALUES(${q(c.name)})`);

  // Only properties carries updated_at; stamping it is the whole reason the
  // column exists, and created_at is deliberately never touched.
  if (meta.columns.some((c) => c.name === "updated_at")) {
    updates.push(`updated_at = NOW()`);
  }

  return [
    `INSERT INTO ${q(meta.table)} (${colList})
     SELECT ${colList} FROM ${q(stg)}
     ON DUPLICATE KEY UPDATE ${updates.join(", ")}`,
  ];
}

/** Delete this batch's parcels wholesale, then reinsert. */
function replaceByTmkSql(meta: TableMeta): string[] {
  const stg = stagingTable(meta.table);
  const colList = stagingColumns(meta)
    .map((c) => q(c.name))
    .join(", ");
  return [
    `DELETE ${q("t")} FROM ${q(meta.table)} ${q("t")}
     JOIN (SELECT DISTINCT tmk FROM ${q(stg)}) k ON k.tmk = ${q("t")}.tmk`,
    `INSERT INTO ${q(meta.table)} (${colList}) SELECT ${colList} FROM ${q(stg)}`,
  ];
}

/** Update where the natural key matches, insert where it doesn't. */
function matchNaturalSql(meta: TableMeta, match: string[]): string[] {
  const stg = stagingTable(meta.table);
  const matchCols = pick(meta, match);
  const on = `t.tmk = s.tmk AND ${allEqual("t", "s", matchCols)}`;

  const matchSet = new Set([...match, "tmk"]);
  const updatable = stagingColumns(meta).filter(
    (c) => !matchSet.has(c.name) && c.name !== "created_at",
  );
  const colList = stagingColumns(meta)
    .map((c) => q(c.name))
    .join(", ");

  const statements: string[] = [];

  if (updatable.length > 0) {
    statements.push(
      `UPDATE ${q(meta.table)} t
       JOIN ${q(stg)} s ON ${on}
       SET ${updatable.map((c) => `t.${q(c.name)} = s.${q(c.name)}`).join(", ")}`,
    );
  }

  statements.push(
    `INSERT INTO ${q(meta.table)} (${colList})
     SELECT ${stagingColumns(meta)
       .map((c) => `s.${q(c.name)}`)
       .join(", ")}
     FROM ${q(stg)} s
     LEFT JOIN ${q(meta.table)} t ON ${on}
     WHERE t.id IS NULL`,
  );

  return statements;
}

/**
 * Change detection, set-based.
 *
 * Mirrors batchUpsertSnapshot() in qpub-load.ts: compare against the LATEST
 * version per (tmk + identity) only. Comparing against any historical version
 * would let a value that was superseded years ago silently re-match, extending
 * a dead row instead of recording that the value came back. (Unlike the row
 * path this is not occurrence-aware — see the scd note in
 * qpub-delta-strategy.ts.)
 */
function scdSql(meta: TableMeta, identity: string[]): string[] {
  const stg = stagingTable(meta.table);
  const latest = latestTable(meta.table);
  const identCols = pick(meta, identity);
  const dataCols = dataColumns(meta, identity);

  const partition = ["tmk", ...identity].map(q).join(", ");
  const carried = ["id", "tmk", ...identity, ...dataCols.map((c) => c.name)]
    .map(q)
    .join(", ");

  const sameRow = `s.tmk = l.tmk
       AND ${allEqual("l", "s", identCols)}
       AND ${allEqual("l", "s", dataCols)}`;

  const insertCols = stagingColumns(meta);
  const colList = insertCols.map((c) => q(c.name)).join(", ");

  return [
    `DROP TABLE IF EXISTS ${q(latest)}`,
    // Scoped to this batch's parcels, so the window function never sweeps the
    // whole table.
    `CREATE TABLE ${q(latest)} AS
     SELECT ${carried} FROM (
       SELECT t.*, ROW_NUMBER() OVER (
         PARTITION BY ${partition}
         ORDER BY t.last_year_observed DESC, t.id DESC
       ) AS rn
       FROM ${q(meta.table)} t
       JOIN (SELECT DISTINCT tmk FROM ${q(stg)}) k ON k.tmk = t.tmk
     ) ranked WHERE rn = 1`,
    // id carries the UPDATE's join, tmk the INSERT's. CREATE TABLE ... SELECT
    // copies types but no indexes, so both are added explicitly.
    `ALTER TABLE ${q(latest)} ADD INDEX idx_latest_id (id), ADD INDEX idx_latest_tmk (tmk)`,
    // Unchanged → extend the existing version's span.
    `UPDATE ${q(meta.table)} t
     JOIN ${q(latest)} l ON l.id = t.id
     JOIN ${q(stg)} s ON ${sameRow}
     SET t.last_year_observed = s.last_year_observed,
         t.scraped_at = s.scraped_at`,
    // New parcel, new identity, or changed data → a new version, old row kept.
    `INSERT INTO ${q(meta.table)} (${colList})
     SELECT ${insertCols.map((c) => `s.${q(c.name)}`).join(", ")}
     FROM ${q(stg)} s
     LEFT JOIN ${q(latest)} l ON ${sameRow}
     WHERE l.id IS NULL`,
    `DROP TABLE IF EXISTS ${q(latest)}`,
  ];
}

/** The statements that apply a staged batch to its real table, in order. */
export function applySql(meta: TableMeta): string[] {
  const strategy: DeltaStrategy | undefined = DELTA_STRATEGY[meta.table];
  if (!strategy) {
    throw new Error(`No delta strategy defined for table "${meta.table}"`);
  }

  switch (strategy.kind) {
    case "upsert-key":
      return upsertKeySql(meta, strategy.key);
    case "replace-by-tmk":
      return replaceByTmkSql(meta);
    case "match-natural":
      return matchNaturalSql(meta, strategy.match);
    case "scd":
      return scdSql(meta, strategy.identity);
  }
}
