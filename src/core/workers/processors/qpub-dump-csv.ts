/**
 * QPub CSV dump — export tables from the remote production database to
 * RFC-4180 CSV files on the NAS datashare.
 *
 * Reads through the app's remote connection (src/lib/mysql/hhdb.ts), so it
 * dumps whatever HH_DB_HOST/HH_DB_NAME point at. Date and datetime columns
 * are formatted server-side with DATE_FORMAT so the driver's UTC-anchored
 * Date objects never touch the output (see the HST convention in
 * src/core/catalog/utils/time.ts). NULL is written as an empty field.
 */

import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";

import { hstToday } from "@catalog/utils/time";
import { rawQuery } from "@/lib/mysql/hhdb";
import { createLogger } from "@/core/observability/logger";

import { ALL_DATA_TABLES } from "./qpub-db-sync";

const log = createLogger("qpub-dump-csv");

const DATASHARE_ROOT = "/Volumes/UHEROroot/datashare/qpub";
const CHUNK_SIZE = 50_000;

interface ColumnInfo {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
}

interface TableDumpResult {
  table: string;
  rows: number;
  file: string;
}

export interface DumpCsvResult {
  outDir: string;
  tables: TableDumpResult[];
  totalRows: number;
}

async function getColumns(table: string): Promise<ColumnInfo[]> {
  const rows = await rawQuery<{
    COLUMN_NAME: string;
    DATA_TYPE: string;
    COLUMN_KEY: string;
  }>(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ORDINAL_POSITION`,
    [table],
  );
  return rows.map((r) => ({
    name: r.COLUMN_NAME,
    dataType: r.DATA_TYPE.toLowerCase(),
    isPrimaryKey: r.COLUMN_KEY === "PRI",
  }));
}

/**
 * SELECT expression for one column. Temporal types are formatted by the
 * server so the wall-clock value stored in the column is exactly what lands
 * in the CSV. Everything is aliased back to its own name (backticked —
 * `rank` and `view` are keywords).
 */
function selectExpr(col: ColumnInfo): string {
  const q = `\`${col.name}\``;
  if (col.dataType === "date") {
    return `DATE_FORMAT(${q}, '%Y-%m-%d') AS ${q}`;
  }
  if (col.dataType === "datetime" || col.dataType === "timestamp") {
    return `DATE_FORMAT(${q}, '%Y-%m-%d %H:%i:%s') AS ${q}`;
  }
  return q;
}

/** RFC 4180: quote when the value contains a comma, quote, or newline. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function dumpTable(
  table: string,
  outDir: string,
): Promise<TableDumpResult> {
  const columns = await getColumns(table);
  if (columns.length === 0) {
    throw new Error(`Table not found on remote: ${table}`);
  }

  const selectList = columns.map(selectExpr).join(", ");
  const pkCols = columns.filter((c) => c.isPrimaryKey);
  // Keyset pagination needs a single-column PK; composite/no-PK tables fall
  // back to OFFSET, which is fine at their sizes.
  const keyCol = pkCols.length === 1 ? pkCols[0].name : null;

  const file = path.join(outDir, `${table}.csv`);
  const writer = Bun.file(file).writer();
  writer.write(columns.map((c) => csvField(c.name)).join(",") + "\n");

  let rows = 0;
  let lastKey: unknown = null;
  let offset = 0;

  for (;;) {
    const chunk = keyCol
      ? await rawQuery<Record<string, unknown>>(
          lastKey === null
            ? `SELECT ${selectList} FROM \`${table}\` ORDER BY \`${keyCol}\` LIMIT ${CHUNK_SIZE}`
            : `SELECT ${selectList} FROM \`${table}\` WHERE \`${keyCol}\` > ? ORDER BY \`${keyCol}\` LIMIT ${CHUNK_SIZE}`,
          lastKey === null ? [] : [lastKey as string | number],
        )
      : await rawQuery<Record<string, unknown>>(
          `SELECT ${selectList} FROM \`${table}\` LIMIT ${CHUNK_SIZE} OFFSET ${offset}`,
        );

    for (const row of chunk) {
      writer.write(
        columns.map((c) => csvField(row[c.name])).join(",") + "\n",
      );
    }
    rows += chunk.length;

    if (chunk.length < CHUNK_SIZE) break;
    if (keyCol) {
      lastKey = chunk[chunk.length - 1][keyCol];
    } else {
      offset += CHUNK_SIZE;
    }
  }

  await writer.end();
  log.info({ table, rows, file }, "Table dumped");
  return { table, rows, file };
}

/**
 * Dump remote tables to CSV files under the NAS datashare.
 *
 * @param opts.table  Dump a single table (any table on the remote, e.g.
 *                    tg_transactions). Default: all pipeline data tables.
 * @param opts.out    Output directory. Default:
 *                    /Volumes/UHEROroot/datashare/qpub/<YYYY-MM-DD> (HST).
 */
export async function runDumpCsv(opts: {
  table?: string;
  out?: string;
}): Promise<DumpCsvResult> {
  const outDir = opts.out ?? path.join(DATASHARE_ROOT, hstToday());

  // Fail early with a clear message if the NAS isn't mounted.
  if (!opts.out && !existsSync(path.dirname(DATASHARE_ROOT))) {
    throw new Error(
      `NAS not mounted: ${path.dirname(DATASHARE_ROOT)} does not exist`,
    );
  }
  await mkdir(outDir, { recursive: true });

  const tables = opts.table ? [opts.table] : ALL_DATA_TABLES;
  log.info({ outDir, tables: tables.length }, "Dumping remote tables to CSV");

  const results: TableDumpResult[] = [];
  for (const table of tables) {
    results.push(await dumpTable(table, outDir));
  }

  const totalRows = results.reduce((sum, r) => sum + r.rows, 0);
  log.info({ outDir, tables: results.length, totalRows }, "CSV dump complete");
  return { outDir, tables: results, totalRows };
}
